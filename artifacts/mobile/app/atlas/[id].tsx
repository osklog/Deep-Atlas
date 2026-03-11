import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, Modal,
} from "react-native";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Atlas, AtlasNode } from "@/types/atlas";
import { getAtlas, updateNode, deleteEdge, saveAtlas } from "@/storage/atlasStorage";
import { MapView, MapViewHandle } from "@/components/MapView";
import { shareAtlas } from "@/lib/export";
import Colors from "@/constants/colors";

const C = Colors.dark;
const PERSIST_DEBOUNCE = 2000;

export default function AtlasMapScreen() {
  const { id, focusNodeId } = useLocalSearchParams<{ id: string; focusNodeId?: string }>();
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "connect">("view");
  const [highlightNodeId, setHighlightNodeId] = useState<string | null>(focusNodeId ?? null);
  const [showMenu, setShowMenu] = useState(false);
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapViewHandle>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, []);

  function schedulePersist() {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => persistNodePositions(), PERSIST_DEBOUNCE);
  }

  async function persistNodePositions() {
    if (!atlas || !id) return;
    const positions = mapRef.current?.getPositions();
    if (!positions) return;
    const updatedAtlas = { ...atlas };
    let changed = false;
    for (const node of updatedAtlas.nodes) {
      const pos = positions.get(node.id);
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
        router.push({
          pathname: "/atlas/[id]/edge-form",
          params: { id, sourceId: connectingFrom, targetId: node.id },
        });
        setConnectingFrom(null);
        setMode("view");
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
          text: "Delete Link", style: "destructive",
          onPress: async () => {
            const updated = await deleteEdge(id, edgeId);
            if (updated) setAtlas(updated);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  }

  async function handleExport(format: "json" | "markdown") {
    setShowMenu(false);
    if (!atlas) return;
    await persistNodePositions();
    try {
      const ok = await shareAtlas(atlas, format);
      if (!ok) Alert.alert("Sharing not available", "Sharing is not supported on this device.");
    } catch (err: any) {
      Alert.alert("Export failed", err?.message ?? "Could not export atlas.");
    }
  }

  function handleAutoLayout() {
    setShowMenu(false);
    if (!atlas || atlas.nodes.length === 0) return;
    const positions = mapRef.current?.getPositions();
    if (!positions) return;

    const cx = 250, cy = 300;
    const n = atlas.nodes.length;

    if (n <= 1) {
      const node = atlas.nodes[0];
      positions.set(node.id, { x: cx, y: cy });
    } else {
      const innerCount = Math.min(n - 1, 7);
      const outerCount = Math.max(0, n - 1 - innerCount);
      positions.set(atlas.nodes[0].id, { x: cx, y: cy });
      for (let i = 0; i < innerCount; i++) {
        const angle = (2 * Math.PI * i) / innerCount - Math.PI / 2;
        positions.set(atlas.nodes[i + 1].id, {
          x: cx + 160 * Math.cos(angle),
          y: cy + 160 * Math.sin(angle),
        });
      }
      for (let i = 0; i < outerCount; i++) {
        const angle = (2 * Math.PI * i) / outerCount - Math.PI / 2;
        positions.set(atlas.nodes[innerCount + 1 + i].id, {
          x: cx + 290 * Math.cos(angle),
          y: cy + 290 * Math.sin(angle),
        });
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    schedulePersist();
    setTimeout(() => mapRef.current?.fitToView(), 50);
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
          <Text style={styles.atlasTitle} numberOfLines={1}>{atlas.title}</Text>
          <Text style={styles.atlasStat}>
            {atlas.nodes.length} nodes · {atlas.edges.length} links
          </Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowMenu(true);
          }}
          style={styles.menuBtn}
        >
          <Feather name="more-horizontal" size={18} color={C.textSecondary} />
        </Pressable>
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
        ref={mapRef}
        atlas={atlas}
        onNodePress={handleNodePress}
        onNodeLongPress={handleNodeLongPress}
        onCanvasLongPress={handleCanvasLongPress}
        onEdgeTap={handleEdgeTap}
        onDragEnd={schedulePersist}
        connectingFrom={connectingFrom}
        selectedNodeId={selectedNodeId}
        highlightNodeId={highlightNodeId}
      />

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        {mode === "connect" ? (
          <View style={styles.connectingBanner}>
            <Feather name="git-branch" size={14} color={C.tint} />
            <Text style={styles.connectingText}>
              {connectingFrom ? "Select target node" : "Select source node"}
            </Text>
            <Pressable onPress={() => { setMode("view"); setConnectingFrom(null); }}>
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
                <Text style={styles.toolBtnText}>Add</Text>
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
                onPress={() => mapRef.current?.fitToView()}
                style={styles.toolBtn}
              >
                <Feather name="maximize" size={18} color={C.textSecondary} />
                <Text style={[styles.toolBtnText, { color: C.textSecondary }]}>Fit</Text>
              </Pressable>
              <View style={styles.toolDivider} />
              <Pressable
                onPress={async () => {
                  await persistNodePositions();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>Atlas Options</Text>

            <Pressable style={styles.menuItem} onPress={handleAutoLayout}>
              <Feather name="grid" size={18} color={C.tint} />
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemLabel}>Auto Layout</Text>
                <Text style={styles.menuItemDesc}>Arrange nodes in a radial pattern</Text>
              </View>
            </Pressable>

            <Pressable style={styles.menuItem} onPress={() => handleExport("json")}>
              <Feather name="download" size={18} color={C.tint} />
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemLabel}>Export JSON</Text>
                <Text style={styles.menuItemDesc}>Full atlas data for backup or transfer</Text>
              </View>
            </Pressable>

            <Pressable style={styles.menuItem} onPress={() => handleExport("markdown")}>
              <Feather name="file-text" size={18} color={C.tint} />
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemLabel}>Export Markdown</Text>
                <Text style={styles.menuItemDesc}>Human-readable summary of your atlas</Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.menuItem, { borderBottomWidth: 0 }]}
              onPress={() => setShowMenu(false)}
            >
              <Feather name="x" size={18} color={C.textMuted} />
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemLabel, { color: C.textMuted }]}>Cancel</Text>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.backgroundDeep },
  loadingContainer: {
    flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.background,
  },
  topBar: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    paddingBottom: 10, gap: 8,
    backgroundColor: C.background + "F0",
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle, zIndex: 10,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.backgroundCard, borderWidth: 1, borderColor: C.borderSubtle,
  },
  titleBlock: { flex: 1 },
  atlasTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: C.text },
  atlasStat: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular" },
  menuBtn: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.backgroundCard, borderWidth: 1, borderColor: C.borderSubtle,
  },
  aiBtn: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.tintGlow, borderWidth: 1, borderColor: C.tint + "40",
  },
  bottomBar: {
    backgroundColor: C.background + "F0",
    borderTopWidth: 1, borderTopColor: C.borderSubtle,
    paddingHorizontal: 16, paddingTop: 10, gap: 8,
  },
  toolBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.backgroundCard, borderRadius: 14,
    borderWidth: 1, borderColor: C.borderSubtle, overflow: "hidden",
  },
  toolBtn: {
    flex: 1, flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: 4, paddingVertical: 10,
  },
  toolBtnText: { fontSize: 11, color: C.tint, fontFamily: "Inter_500Medium" },
  toolDivider: { width: 1, height: 32, backgroundColor: C.borderSubtle },
  connectingBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.tintGlow, borderRadius: 12,
    borderWidth: 1, borderColor: C.tint + "40", padding: 12,
  },
  connectingText: { flex: 1, fontSize: 14, color: C.tint, fontFamily: "Inter_500Medium" },
  selectedNodeBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.backgroundCard, borderRadius: 10,
    borderWidth: 1, borderColor: C.borderSubtle,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  selectedNodeText: { flex: 1, fontSize: 14, color: C.text, fontFamily: "Inter_500Medium" },
  menuOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end",
  },
  menuSheet: {
    backgroundColor: C.backgroundCard, borderTopLeftRadius: 20,
    borderTopRightRadius: 20, paddingTop: 12, paddingHorizontal: 20,
  },
  menuHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: C.borderMid, alignSelf: "center", marginBottom: 16,
  },
  menuTitle: {
    fontSize: 16, fontFamily: "Inter_600SemiBold", color: C.text, marginBottom: 16,
  },
  menuItem: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  menuItemContent: { flex: 1 },
  menuItemLabel: { fontSize: 15, fontFamily: "Inter_500Medium", color: C.text },
  menuItemDesc: { fontSize: 12, color: C.textMuted, fontFamily: "Inter_400Regular", marginTop: 2 },
});
