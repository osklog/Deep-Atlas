import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Atlas, AtlasNode } from "@/types/atlas";
import {
  getAtlas,
  updateNode,
  deleteEdge,
  saveAtlas,
} from "@/storage/atlasStorage";
import { MapView } from "@/components/MapView";
import Colors from "@/constants/colors";

const C = Colors.dark;

export default function AtlasMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "connect">("view");
  const insets = useSafeAreaInsets();
  const nodePositionRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const loadAtlas = useCallback(async () => {
    if (!id) return;
    const data = await getAtlas(id);
    setAtlas(data);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadAtlas();
    }, [loadAtlas])
  );

  async function persistNodePositions() {
    if (!atlas || !id) return;
    const updatedAtlas = { ...atlas };
    let changed = false;
    for (const node of updatedAtlas.nodes) {
      const pos = nodePositionRef.current.get(node.id);
      if (pos && (pos.x !== node.x || pos.y !== node.y)) {
        node.x = pos.x;
        node.y = pos.y;
        changed = true;
      }
    }
    if (changed) {
      updatedAtlas.updatedAt = new Date().toISOString();
      await saveAtlas(updatedAtlas);
      setAtlas({ ...updatedAtlas });
    }
  }

  function handleNodePress(node: AtlasNode) {
    if (mode === "connect") {
      if (!connectingFrom) {
        setConnectingFrom(node.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (connectingFrom === node.id) {
        setConnectingFrom(null);
      } else {
        const sourceNode = atlas?.nodes.find((n) => n.id === connectingFrom);
        const targetNode = node;
        if (sourceNode && targetNode) {
          router.push({
            pathname: "/atlas/[id]/edge-form",
            params: { id, sourceId: connectingFrom, targetId: targetNode.id },
          });
          setConnectingFrom(null);
          setMode("view");
        }
      }
    } else {
      setSelectedNodeId(node.id === selectedNodeId ? null : node.id);
    }
  }

  function handleNodeLongPress(node: AtlasNode) {
    setSelectedNodeId(node.id);
    router.push({
      pathname: "/atlas/[id]/node-detail",
      params: { id, nodeId: node.id },
    });
  }

  function handleCanvasLongPress(x: number, y: number) {
    router.push({
      pathname: "/atlas/[id]/node-form",
      params: { id, spawnX: Math.round(x), spawnY: Math.round(y) },
    });
  }

  async function handleEdgeTap(edgeId: string) {
    const edge = atlas?.edges.find((e) => e.id === edgeId);
    if (!edge || !atlas) return;
    const src = atlas.nodes.find((n) => n.id === edge.sourceId);
    const tgt = atlas.nodes.find((n) => n.id === edge.targetId);
    Alert.alert(
      `"${edge.label}"`,
      `${src?.title ?? "?"} → ${tgt?.title ?? "?"}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Link",
          style: "destructive",
          onPress: async () => {
            const updated = await deleteEdge(id, edgeId);
            if (updated) setAtlas(updated);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={C.tint} />
      </View>
    );
  }

  if (!atlas) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: C.textSecondary }}>Atlas not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={async () => {
            await persistNodePositions();
            router.back();
          }}
          style={styles.backBtn}
        >
          <Feather name="chevron-left" size={24} color={C.text} />
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.atlasTitle} numberOfLines={1}>
            {atlas.title}
          </Text>
          <Text style={styles.atlasStat}>
            {atlas.nodes.length} nodes · {atlas.edges.length} links
          </Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({ pathname: "/atlas/[id]/ai-generate", params: { id } });
          }}
          style={styles.aiBtn}
        >
          <Feather name="zap" size={18} color={C.tint} />
        </Pressable>
      </View>

      <MapView
        atlas={atlas}
        onNodePress={handleNodePress}
        onNodeLongPress={handleNodeLongPress}
        onCanvasLongPress={handleCanvasLongPress}
        onEdgeTap={handleEdgeTap}
        connectingFrom={connectingFrom}
        selectedNodeId={selectedNodeId}
      />

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        {mode === "connect" ? (
          <View style={styles.connectingBanner}>
            <Feather name="git-branch" size={14} color={C.tint} />
            <Text style={styles.connectingText}>
              {connectingFrom
                ? `Select target node`
                : "Select source node"}
            </Text>
            <Pressable
              onPress={() => {
                setMode("view");
                setConnectingFrom(null);
              }}
            >
              <Feather name="x" size={18} color={C.textSecondary} />
            </Pressable>
          </View>
        ) : (
          <>
            {selectedNodeId && (
              <Pressable
                onPress={() => {
                  const node = atlas.nodes.find((n) => n.id === selectedNodeId);
                  if (!node) return;
                  router.push({
                    pathname: "/atlas/[id]/node-detail",
                    params: { id, nodeId: selectedNodeId },
                  });
                }}
                style={styles.selectedNodeBar}
              >
                <Text style={styles.selectedNodeText} numberOfLines={1}>
                  {atlas.nodes.find((n) => n.id === selectedNodeId)?.title}
                </Text>
                <Feather name="chevron-up" size={16} color={C.tint} />
              </Pressable>
            )}
            <View style={styles.toolBar}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const cx = 150 + Math.random() * 80;
                  const cy = 200 + Math.random() * 80;
                  router.push({
                    pathname: "/atlas/[id]/node-form",
                    params: { id, spawnX: Math.round(cx), spawnY: Math.round(cy) },
                  });
                }}
                style={styles.toolBtn}
              >
                <Feather name="plus-circle" size={18} color={C.tint} />
                <Text style={styles.toolBtnText}>Add Node</Text>
              </Pressable>
              <View style={styles.toolDivider} />
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setMode("connect");
                  setSelectedNodeId(null);
                }}
                style={styles.toolBtn}
              >
                <Feather name="git-branch" size={18} color={C.textSecondary} />
                <Text style={[styles.toolBtnText, { color: C.textSecondary }]}>Link</Text>
              </Pressable>
              <View style={styles.toolDivider} />
              <Pressable
                onPress={async () => {
                  await persistNodePositions();
                }}
                style={styles.toolBtn}
              >
                <Feather name="save" size={18} color={C.textMuted} />
                <Text style={[styles.toolBtnText, { color: C.textMuted }]}>Save</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.backgroundDeep },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
    backgroundColor: C.background + "F0",
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    zIndex: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.backgroundCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  titleBlock: { flex: 1 },
  atlasTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  atlasStat: {
    fontSize: 12,
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
  },
  aiBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.tintGlow,
    borderWidth: 1,
    borderColor: C.tint + "40",
  },
  bottomBar: {
    backgroundColor: C.background + "F0",
    borderTopWidth: 1,
    borderTopColor: C.borderSubtle,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  toolBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.backgroundCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    overflow: "hidden",
  },
  toolBtn: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
  },
  toolBtnText: {
    fontSize: 11,
    color: C.tint,
    fontFamily: "Inter_500Medium",
  },
  toolDivider: {
    width: 1,
    height: 32,
    backgroundColor: C.borderSubtle,
  },
  connectingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.tintGlow,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.tint + "40",
    padding: 12,
  },
  connectingText: {
    flex: 1,
    fontSize: 14,
    color: C.tint,
    fontFamily: "Inter_500Medium",
  },
  selectedNodeBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.backgroundCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedNodeText: {
    flex: 1,
    fontSize: 14,
    color: C.text,
    fontFamily: "Inter_500Medium",
  },
});
