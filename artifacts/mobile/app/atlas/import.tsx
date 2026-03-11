import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createAtlasFromImport } from "@/storage/atlasStorage";
import Colors from "@/constants/colors";

const C = Colors.dark;
const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api-server`;

interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  isImage: boolean;
  // resolved content (set during upload)
  content?: string;
  isBase64?: boolean;
}

type Stage = "pick" | "reading" | "importing" | "done";

const IMAGE_MIMES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic",
]);

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...(bytes.slice(i, i + chunk) as any));
  }
  return btoa(binary);
}

export default function ImportScreen() {
  const insets = useSafeAreaInsets();
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<Stage>("pick");
  const [progress, setProgress] = useState("");

  async function pickDocuments() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const picked: PickedFile[] = result.assets.map((a) => ({
        uri: a.uri,
        name: a.name,
        mimeType: a.mimeType ?? "application/octet-stream",
        size: a.size,
        isImage: IMAGE_MIMES.has((a.mimeType ?? "").toLowerCase()),
      }));
      setFiles((prev) => dedup([...prev, ...picked]));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert("Error", "Could not open file picker.");
    }
  }

  async function pickImages() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: true,
      });
      if (result.canceled) return;
      const picked: PickedFile[] = result.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? `photo_${Date.now()}.jpg`,
        mimeType: a.mimeType ?? "image/jpeg",
        size: a.fileSize,
        isImage: true,
        // pre-populate base64 content from image picker
        content: a.base64 ?? undefined,
        isBase64: a.base64 != null,
      }));
      setFiles((prev) => dedup([...prev, ...picked]));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert("Error", "Could not open photo library.");
    }
  }

  function dedup(list: PickedFile[]): PickedFile[] {
    const seen = new Set<string>();
    return list.filter((f) => {
      if (seen.has(f.uri)) return false;
      seen.add(f.uri);
      return true;
    });
  }

  function removeFile(uri: string) {
    setFiles((prev) => prev.filter((f) => f.uri !== uri));
    Haptics.selectionAsync();
  }

  async function resolveFileContent(file: PickedFile): Promise<{ content: string; isBase64: boolean } | null> {
    // Already resolved (image picker with base64)
    if (file.content != null && file.isBase64 != null) {
      return { content: file.content, isBase64: file.isBase64 };
    }

    const mime = file.mimeType.toLowerCase();

    if (IMAGE_MIMES.has(mime)) {
      // Read image as base64
      try {
        const buffer = await fetch(file.uri).then((r) => r.arrayBuffer());
        return { content: arrayBufferToBase64(buffer), isBase64: true };
      } catch {
        return null;
      }
    } else {
      // Try to read as text (works for .txt, .md, .json, .csv, .pdf text layers, etc.)
      try {
        const text = await fetch(file.uri).then((r) => r.text());
        if (text && text.length > 5) {
          return { content: text.slice(0, 8000), isBase64: false };
        }
        return null;
      } catch {
        return null;
      }
    }
  }

  async function handleImport() {
    if (files.length === 0) {
      Alert.alert("No files", "Add at least one file or image to import.");
      return;
    }

    setStage("reading");
    setProgress("Reading files…");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const skippedLocally: string[] = [];
    const resolvedFiles: Array<{ name: string; mimeType: string; content: string; isBase64: boolean }> = [];

    for (const file of files) {
      setProgress(`Reading ${file.name}…`);
      const resolved = await resolveFileContent(file);
      if (resolved) {
        resolvedFiles.push({
          name: file.name,
          mimeType: file.mimeType,
          content: resolved.content,
          isBase64: resolved.isBase64,
        });
      } else {
        skippedLocally.push(file.name);
      }
    }

    if (resolvedFiles.length === 0) {
      setStage("pick");
      Alert.alert("Could not read files", "None of the selected files could be read. Try different files.");
      return;
    }

    setStage("importing");
    setProgress("Extracting knowledge with AI…");

    try {
      const body = JSON.stringify({
        title: title.trim() || undefined,
        files: resolvedFiles,
      });

      const resp = await fetch(`${API_BASE}/atlas/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!resp.ok) {
        let errMsg = `Server error ${resp.status}`;
        try {
          const err = await resp.json();
          errMsg = err.error ?? errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      setProgress("Building atlas…");
      const data = await resp.json();

      if (!data.nodes || data.nodes.length === 0) {
        throw new Error("AI could not extract any nodes from the provided content.");
      }

      const atlas = await createAtlasFromImport({
        title: data.title ?? title.trim() ?? "Imported Atlas",
        description: data.description ?? "",
        color: data.color ?? "#6E9CF0",
        nodes: data.nodes,
        edges: data.edges ?? [],
      });

      setStage("done");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const allSkipped = [...skippedLocally, ...(data.skipped ?? [])];
      if (allSkipped.length > 0) {
        Alert.alert(
          "Import complete",
          `${data.nodes.length} nodes created.\n${allSkipped.length} file(s) skipped: ${allSkipped.join(", ")}`,
          [{ text: "View Atlas", onPress: () => navigate(atlas.id) }]
        );
      } else {
        navigate(atlas.id);
      }
    } catch (err: any) {
      setStage("pick");
      Alert.alert("Import failed", err.message ?? "Something went wrong. Please try again.");
    }
  }

  function navigate(atlasId: string) {
    router.dismiss();
    router.push(`/atlas/${atlasId}`);
  }

  function formatSize(bytes?: number) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }

  function fileIcon(f: PickedFile): "image" | "file-text" | "code" | "bar-chart-2" | "file" {
    if (f.isImage) return "image";
    const m = f.mimeType;
    if (m.includes("pdf")) return "file-text";
    if (m.includes("json")) return "code";
    if (m.includes("csv")) return "bar-chart-2";
    return "file";
  }

  const busy = stage === "reading" || stage === "importing";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.dismiss()} style={styles.headerSide} disabled={busy}>
          <Text style={[styles.cancelText, busy && { opacity: 0.4 }]}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Import Files</Text>
        <Pressable
          onPress={handleImport}
          disabled={busy || files.length === 0}
          style={[styles.headerSide, styles.headerRight, (busy || files.length === 0) && { opacity: 0.4 }]}
        >
          {busy
            ? <ActivityIndicator size="small" color={C.tint} />
            : <Text style={styles.importText}>Import</Text>
          }
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Description */}
        <View style={styles.descBox}>
          <Feather name="zap" size={16} color={C.tint} />
          <Text style={styles.descText}>
            Add files, images, notes, or PDFs. AI will extract concepts, people, events and relationships and build a knowledge map automatically.
          </Text>
        </View>

        {/* Optional atlas name */}
        <Text style={styles.label}>Atlas name (optional)</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Leave blank to auto-generate"
          placeholderTextColor={C.textMuted}
          returnKeyType="done"
          editable={!busy}
        />

        {/* Pick buttons */}
        <View style={styles.pickRow}>
          <Pressable style={[styles.pickBtn, busy && { opacity: 0.5 }]} onPress={pickDocuments} disabled={busy}>
            <Feather name="file-plus" size={20} color={C.tint} />
            <Text style={styles.pickBtnText}>Files / PDFs</Text>
          </Pressable>
          <Pressable style={[styles.pickBtn, busy && { opacity: 0.5 }]} onPress={pickImages} disabled={busy}>
            <Feather name="image" size={20} color={C.tint} />
            <Text style={styles.pickBtnText}>Photos</Text>
          </Pressable>
        </View>

        {/* File list */}
        {files.length > 0 && (
          <>
            <Text style={styles.label}>{files.length} file{files.length !== 1 ? "s" : ""} selected</Text>
            {files.map((f) => (
              <View key={f.uri} style={styles.fileRow}>
                <View style={styles.fileIcon}>
                  <Feather name={fileIcon(f)} size={16} color={C.tint} />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                  {f.size != null && <Text style={styles.fileSize}>{formatSize(f.size)}</Text>}
                </View>
                {!busy && (
                  <Pressable onPress={() => removeFile(f.uri)} style={styles.removeBtn}>
                    <Feather name="x" size={16} color={C.textMuted} />
                  </Pressable>
                )}
              </View>
            ))}
          </>
        )}

        {/* Progress */}
        {busy && (
          <View style={styles.progressBox}>
            <ActivityIndicator color={C.tint} />
            <Text style={styles.progressText}>{progress}</Text>
          </View>
        )}

        {/* Empty state */}
        {files.length === 0 && !busy && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="upload-cloud" size={36} color={C.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No files yet</Text>
            <Text style={styles.emptyText}>
              Supports images, text, markdown, JSON, CSV, and PDF files.{"\n"}Bulk upload up to 20 files at once.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.backgroundDeep },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  headerSide: { minWidth: 70 },
  headerRight: { alignItems: "flex-end" },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: C.text },
  cancelText: { fontSize: 16, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  importText: { fontSize: 16, color: C.tint, fontFamily: "Inter_600SemiBold" },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 60 },
  descBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: C.tintGlow,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.tint + "30",
    padding: 14,
    alignItems: "flex-start",
  },
  descText: { flex: 1, fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 19 },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 8,
  },
  input: {
    backgroundColor: C.backgroundCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  pickRow: { flexDirection: "row", gap: 12 },
  pickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.backgroundCard,
    borderWidth: 1,
    borderColor: C.tint + "30",
  },
  pickBtnText: { fontSize: 14, color: C.tint, fontFamily: "Inter_500Medium" },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.backgroundCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: 12,
  },
  fileIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: C.tintGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, color: C.text, fontFamily: "Inter_500Medium" },
  fileSize: { fontSize: 11, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 2 },
  removeBtn: { padding: 6 },
  progressBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: 16,
    marginTop: 8,
  },
  progressText: { flex: 1, fontSize: 14, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", paddingTop: 40, gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: C.backgroundCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: C.text },
  emptyText: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
