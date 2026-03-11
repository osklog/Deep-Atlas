import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getAtlas } from "@/storage/atlasStorage";
import { Atlas } from "@/types/atlas";
import Colors from "@/constants/colors";

const C = Colors.dark;

type Mode = "summary" | "explain" | "questions" | "gaps";

const MODES: Array<{ key: Mode; label: string; icon: string; description: string }> = [
  { key: "summary", label: "Atlas Summary", icon: "book-open", description: "Synthesize what's in this map" },
  { key: "explain", label: "Explain It", icon: "users", description: "Like explaining to a friend" },
  { key: "questions", label: "Next Questions", icon: "help-circle", description: "Rabbit holes left to explore" },
  { key: "gaps", label: "Gaps & Tensions", icon: "alert-circle", description: "Contradictions & blind spots" },
];

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  return "/api";
}

export default function AiGenerateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [selectedMode, setSelectedMode] = useState<Mode>("summary");
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getAtlas(id).then(setAtlas);
  }, [id]);

  async function generate() {
    if (!atlas) return;
    if (atlas.nodes.length === 0) {
      setOutput("Add some nodes to your atlas before generating insights.");
      setHasGenerated(true);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setOutput("");
    setHasGenerated(true);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const body = {
      atlasTitle: atlas.title,
      nodes: atlas.nodes.map((n) => ({
        type: n.type,
        title: n.title,
        note: n.note,
        tags: n.tags,
      })),
      edges: atlas.edges.map((e) => {
        const src = atlas.nodes.find((n) => n.id === e.sourceId);
        const tgt = atlas.nodes.find((n) => n.id === e.targetId);
        return { sourceTitle: src?.title ?? "", targetTitle: tgt?.title ?? "", label: e.label };
      }),
      mode: selectedMode,
    };

    try {
      const response = await fetch(`${getApiBase()}/atlas/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        setOutput("Failed to connect to AI. Please check your connection.");
        setLoading(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                accumulated += data.content;
                setOutput(accumulated);
                scrollRef.current?.scrollToEnd({ animated: false });
              }
              if (data.done || data.error) {
                if (data.error) setOutput((prev) => prev + "\n\n[Error: " + data.error + "]");
              }
            } catch {
              // skip malformed
            }
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setOutput("Connection failed. Make sure the API server is running.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 4 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.dismiss()} style={styles.closeBtn}>
          <Feather name="x" size={20} color={C.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Feather name="zap" size={16} color={C.tint} />
          <Text style={styles.headerTitle}>AI Insights</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {atlas && (
        <View style={styles.atlasInfo}>
          <Text style={styles.atlasInfoText} numberOfLines={1}>
            {atlas.title}
          </Text>
          <Text style={styles.atlasInfoStat}>
            {atlas.nodes.length} nodes · {atlas.edges.length} links
          </Text>
        </View>
      )}

      <View style={styles.modeGrid}>
        {MODES.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => {
              setSelectedMode(m.key);
              setOutput("");
              setHasGenerated(false);
              Haptics.selectionAsync();
            }}
            style={[
              styles.modeCard,
              selectedMode === m.key && styles.modeCardSelected,
            ]}
          >
            <Feather
              name={m.icon as any}
              size={16}
              color={selectedMode === m.key ? C.tint : C.textMuted}
            />
            <Text
              style={[
                styles.modeLabel,
                selectedMode === m.key && styles.modeLabelSelected,
              ]}
            >
              {m.label}
            </Text>
            <Text style={styles.modeDesc}>{m.description}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={generate}
        disabled={loading}
        style={[styles.generateBtn, loading && styles.generateBtnLoading]}
      >
        {loading ? (
          <ActivityIndicator color={C.background} size="small" />
        ) : (
          <Feather name="zap" size={18} color={C.background} />
        )}
        <Text style={styles.generateBtnText}>
          {loading ? "Generating..." : "Generate"}
        </Text>
      </Pressable>

      {hasGenerated && (
        <ScrollView
          ref={scrollRef}
          style={styles.outputScroll}
          contentContainerStyle={[styles.outputContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {output ? (
            <Text style={styles.outputText}>{output}</Text>
          ) : loading ? (
            <View style={styles.outputLoading}>
              <ActivityIndicator color={C.tint} />
              <Text style={styles.outputLoadingText}>Thinking...</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {!hasGenerated && (
        <View style={styles.outputPlaceholder}>
          <Feather name="zap" size={36} color={C.textMuted} style={{ opacity: 0.4 }} />
          <Text style={styles.placeholderText}>
            Select a mode and tap Generate to create AI insights from your atlas
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.backgroundDeep },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.backgroundCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  atlasInfo: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: C.backgroundCard,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  atlasInfoText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  atlasInfoStat: {
    fontSize: 12,
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  modeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 12,
  },
  modeCard: {
    width: "47%",
    backgroundColor: C.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: 12,
    gap: 4,
  },
  modeCardSelected: {
    borderColor: C.tint + "60",
    backgroundColor: C.tintGlow,
  },
  modeLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
    marginTop: 2,
  },
  modeLabelSelected: { color: C.tint },
  modeDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textMuted,
    lineHeight: 16,
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.tint,
    marginBottom: 12,
  },
  generateBtnLoading: { opacity: 0.7 },
  generateBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: C.background,
  },
  outputScroll: { flex: 1 },
  outputContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  outputText: {
    fontSize: 15,
    color: C.text,
    fontFamily: "Inter_400Regular",
    lineHeight: 26,
    backgroundColor: C.backgroundCard,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  outputLoading: {
    alignItems: "center",
    gap: 10,
    paddingTop: 20,
  },
  outputLoadingText: {
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  outputPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  placeholderText: {
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
});
