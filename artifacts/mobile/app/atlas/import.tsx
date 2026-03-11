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
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createAtlasFromImport } from "@/storage/atlasStorage";
import Colors from "@/constants/colors";

const C = Colors.dark;
const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api-server`;
const FETCH_TIMEOUT_MS = 120_000;
const MAX_IMAGE_DIMENSION = 1024; // px — keeps base64 small enough for the proxy

interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  isImage: boolean;
}

type Stage = "pick" | "reading" | "importing";

const IMAGE_MIMES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "image/gif", "image/heic", "image/heif",
]);

function isImageMime(mime: string) {
  return IMAGE_MIMES.has(mime.toLowerCase());
}

export default function ImportScreen() {
  const insets = useSafeAreaInsets();
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<Stage>("pick");
  const [progress, setProgress] = useState("");

  // ── Pickers ───────────────────────────────────────────────────────────────
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
        isImage: isImageMime(a.mimeType ?? ""),
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
        // No base64 here — we'll resize + encode via ImageManipulator
        exif: false,
      });
      if (result.canceled) return;
      const picked: PickedFile[] = result.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? `photo_${Date.now()}.jpg`,
        mimeType: a.mimeType ?? "image/jpeg",
        size: a.fileSize,
        isImage: true,
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

  // ── Read & encode a single file ───────────────────────────────────────────
  async function readFile(
    file: PickedFile
  ): Promise<{ content: string; isBase64: boolean } | null> {
    const mime = file.mimeType.toLowerCase();

    if (file.isImage || isImageMime(mime)) {
      // Resize to max 1024px then return base64 JPEG — keeps payload small
      try {
        const result = await ImageManipulator.manipulateAsync(
          file.uri,
          [{ resize: { width: MAX_IMAGE_DIMENSION } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        if (!result.base64) return null;
        return { content: result.base64, isBase64: true };
      } catch (e) {
        console.warn("Image resize/encode failed:", file.name, e);
        return null;
      }
    } else {
      // Text / JSON / CSV / Markdown / PDF text-layer
      try {
        // Use raw string literals — FileSystem.EncodingType enum is unreliable at runtime
        const text: string = await (FileSystem.readAsStringAsync as Function)(
          file.uri,
          { encoding: "utf8" }
        );
        if (typeof text === "string" && text.trim().length > 5) {
          return { content: text.slice(0, 12_000), isBase64: false };
        }
        return null;
      } catch (e) {
        console.warn("Text read failed:", file.name, e);
        return null;
      }
    }
  }

  // ── Main import handler ───────────────────────────────────────────────────
  async function handleImport() {
    if (files.length === 0) {
      Alert.alert("No files", "Add at least one file or image first.");
      return;
    }

    setStage("reading");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const skippedNames: string[] = [];
    const resolved: Array<{
      name: string;
      mimeType: string;
      content: string;
      isBase64: boolean;
    }> = [];

    for (const file of files) {
      setProgress(`Reading ${file.name}…`);
      const result = await readFile(file);
      if (result) {
        resolved.push({ name: file.name, mimeType: file.mimeType, ...result });
      } else {
        skippedNames.push(file.name);
      }
    }

    if (resolved.length === 0) {
      setStage("pick");
      Alert.alert(
        "Could not read files",
        "None of the files could be read.\n\n• Images: use the Photos button\n• Text: .txt .md .json .csv work best\n• PDFs: only text-layer PDFs are supported"
      );
      return;
    }

    setStage("importing");
    setProgress("Extracting knowledge with AI…");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const resp = await fetch(`${API_BASE}/atlas/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          files: resolved,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        let errMsg = `Server error ${resp.status}`;
        try {
          errMsg = (await resp.json()).error ?? errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      setProgress("Building atlas…");
      const data = await resp.json();

      if (!data.nodes || data.nodes.length === 0) {
        throw new Error(
          "AI couldn't extract any nodes from the content. Try files with more readable text."
        );
      }

      const atlas = await createAtlasFromImport({
        title: data.title ?? title.trim() ?? "Imported Atlas",
        description: data.description ?? "",
        color: data.color ?? "#6E9CF0",
        nodes: data.nodes,
        edges: data.edges ?? [],
      });

      setStage("pick");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const allSkipped = [...skippedNames, ...(data.skipped ?? [])];
      if (allSkipped.length > 0) {
        Alert.alert(
          "Import complete",
          `${data.nodes.length} nodes created.\nSkipped: ${allSkipped.join(", ")}`,
          [{ text: "View Atlas", onPress: () => navigate(atlas.id) }]
        );
      } else {
        navigate(atlas.id);
      }
    } catch (err: any) {
      setStage("pick");
      const isTimeout = err?.name === "AbortError";
      Alert.alert(
        isTimeout ? "Request timed out" : "Import failed",
        isTimeout
          ? "The AI took too long. Try with fewer or smaller files."
          : err.message ?? "Something went wrong. Please try again."
      );
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

  function fileIcon(f: PickedFile) {
    if (f.isImage) return "image" as const;
    if (f.mimeType.includes("pdf")) return "file-text" as const;
    if (f.mimeType.includes("json")) return "code" as const;
    if (f.mimeType.includes("csv")) return "bar-chart-2" as const;
    return "file" as const;
  }

  const busy = stage === "reading" || stage === "importing";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => { if (!busy) router.dismiss(); }}
          style={styles.headerSide}
          disabled={busy}
        >
          <Text style={[styles.cancelText, busy && { opacity: 0.4 }]}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Import Files</Text>
        <Pressable
          onPress={handleImport}
          disabled={busy || files.length === 0}
          style={[
            styles.headerSide,
            styles.headerRight,
            (busy || files.length === 0) && { opacity: 0.4 },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={C.tint} />
          ) : (
            <Text style={styles.importText}>Import</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info banner */}
        <View style={styles.descBox}>
          <Feather name="zap" size={16} color={C.tint} />
          <Text style={styles.descText}>
            Add photos, text files, notes, or PDFs. AI extracts concepts, people, events and
            relationships and builds a knowledge map automatically.
          </Text>
        </View>

        {/* Atlas name */}
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
          <Pressable
            style={[styles.pickBtn, busy && { opacity: 0.5 }]}
            onPress={pickDocuments}
            disabled={busy}
          >
            <Feather name="file-plus" size={20} color={C.tint} />
            <Text style={styles.pickBtnText}>Files / PDFs</Text>
          </Pressable>
          <Pressable
            style={[styles.pickBtn, busy && { opacity: 0.5 }]}
            onPress={pickImages}
            disabled={busy}
          >
            <Feather name="image" size={20} color={C.tint} />
            <Text style={styles.pickBtnText}>Photos</Text>
          </Pressable>
        </View>

        {/* File list */}
        {files.length > 0 && (
          <>
            <Text style={styles.label}>
              {files.length} file{files.length !== 1 ? "s" : ""} selected
            </Text>
            {files.map((f) => (
              <View key={f.uri} style={styles.fileRow}>
                <View style={styles.fileIconBox}>
                  <Feather name={fileIcon(f)} size={16} color={C.tint} />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {f.name}
                  </Text>
                  {f.size != null && (
                    <Text style={styles.fileSize}>{formatSize(f.size)}</Text>
                  )}
                </View>
                {!busy && (
                  <Pressable
                    onPress={() => removeFile(f.uri)}
                    style={styles.removeBtn}
                    hitSlop={8}
                  >
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
            <View style={styles.emptyIconBox}>
              <Feather name="upload-cloud" size={36} color={C.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No files yet</Text>
            <Text style={styles.emptyText}>
              Photos, text, markdown, JSON, CSV, PDF.{"\n"}Up to 20 files at once.
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
  descText: {
    flex: 1,
    fontSize: 13,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
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
  fileIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: C.tintGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, color: C.text, fontFamily: "Inter_500Medium" },
  fileSize: {
    fontSize: 11,
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
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
  progressText: {
    flex: 1,
    fontSize: 14,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  emptyState: { alignItems: "center", paddingTop: 40, gap: 12 },
  emptyIconBox: {
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
  emptyText: {
    fontSize: 13,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
