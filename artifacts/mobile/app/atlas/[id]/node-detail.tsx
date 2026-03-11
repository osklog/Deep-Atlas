import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getAtlas } from "@/storage/atlasStorage";
import { AtlasNode, AtlasEdge, Atlas, NODE_ICONS, NODE_LABELS } from "@/types/atlas";
import { NodeTypeBadge } from "@/components/ui/NodeTypeBadge";
import Colors from "@/constants/colors";

const C = Colors.dark;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function NodeDetailScreen() {
  const { id, nodeId } = useLocalSearchParams<{ id: string; nodeId: string }>();
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [node, setNode] = useState<AtlasNode | null>(null);
  const [related, setRelated] = useState<Array<{ edge: AtlasEdge; otherNode: AtlasNode; direction: "out" | "in" }>>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getAtlas(id).then((a) => {
      if (!a) return;
      setAtlas(a);
      const n = a.nodes.find((x) => x.id === nodeId);
      if (!n) return;
      setNode(n);
      const rels: typeof related = [];
      for (const edge of a.edges) {
        if (edge.sourceId === nodeId) {
          const other = a.nodes.find((x) => x.id === edge.targetId);
          if (other) rels.push({ edge, otherNode: other, direction: "out" });
        } else if (edge.targetId === nodeId) {
          const other = a.nodes.find((x) => x.id === edge.sourceId);
          if (other) rels.push({ edge, otherNode: other, direction: "in" });
        }
      }
      setRelated(rels);
    });
  }, [id, nodeId]);

  if (!node) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={C.tint} />
      </View>
    );
  }

  const nodeColor = C.nodeColors[node.type];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 4 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.dismiss()} style={styles.closeBtn}>
          <Feather name="x" size={20} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.replace({
              pathname: "/atlas/[id]/node-form",
              params: { id, nodeId },
            });
          }}
          style={styles.editBtn}
        >
          <Feather name="edit-2" size={16} color={C.tint} />
          <Text style={styles.editBtnText}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <View style={[styles.typeIcon, { backgroundColor: nodeColor + "20" }]}>
            <Feather name={NODE_ICONS[node.type] as any} size={24} color={nodeColor} />
          </View>
          <View style={{ flex: 1 }}>
            <NodeTypeBadge type={node.type} />
            <Text style={styles.title}>{node.title}</Text>
          </View>
        </View>

        {node.note ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.noteText}>{node.note}</Text>
          </View>
        ) : null}

        {node.imageUri ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Attachment</Text>
            <Image
              source={{ uri: node.imageUri }}
              style={styles.image}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {node.tags.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Tags</Text>
            <View style={styles.tagList}>
              {node.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {related.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Connections ({related.length})</Text>
            <View style={styles.relatedList}>
              {related.map(({ edge, otherNode, direction }) => (
                <Pressable
                  key={edge.id}
                  style={styles.relatedCard}
                  onPress={() => {
                    router.push({
                      pathname: "/atlas/[id]/node-detail",
                      params: { id, nodeId: otherNode.id },
                    });
                  }}
                >
                  <View style={[styles.relatedDot, { backgroundColor: C.nodeColors[otherNode.type] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.relatedTitle}>{otherNode.title}</Text>
                    <Text style={styles.relatedLabel}>
                      {direction === "out" ? `→ ${edge.label}` : `← ${edge.label}`}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={14} color={C.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.dateText}>Added {formatDate(node.createdAt)}</Text>
          {node.updatedAt !== node.createdAt && (
            <Text style={styles.dateText}>Updated {formatDate(node.updatedAt)}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.backgroundDeep },
  container: { flex: 1, backgroundColor: C.backgroundDeep },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
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
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: C.tintGlow,
    borderWidth: 1,
    borderColor: C.tint + "30",
  },
  editBtnText: {
    fontSize: 14,
    color: C.tint,
    fontFamily: "Inter_600SemiBold",
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 4 },
  titleRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  typeIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: C.text,
    lineHeight: 30,
    marginTop: 6,
  },
  section: { marginTop: 20 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  noteText: {
    fontSize: 15,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    lineHeight: 24,
    backgroundColor: C.backgroundCard,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  image: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  tagList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    backgroundColor: C.backgroundElevated,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 13,
    color: C.tint,
    fontFamily: "Inter_400Regular",
  },
  relatedList: { gap: 8 },
  relatedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.backgroundCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: 12,
  },
  relatedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  relatedTitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: C.text,
  },
  relatedLabel: {
    fontSize: 12,
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  dateText: {
    fontSize: 12,
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
    marginBottom: 2,
  },
});
