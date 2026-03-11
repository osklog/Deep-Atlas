import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  TouchableOpacity,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Defs, Marker, Path } from "react-native-svg";
import { Atlas, AtlasNode, NODE_ICONS } from "@/types/atlas";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const C = Colors.dark;
const NODE_RADIUS = 34; // hit area radius in canvas units

interface Props {
  atlas: Atlas;
  onNodePress: (node: AtlasNode) => void;
  onNodeLongPress: (node: AtlasNode) => void;
  onCanvasLongPress?: (x: number, y: number) => void;
  onEdgeTap?: (edgeId: string) => void;
  connectingFrom?: string | null;
  selectedNodeId?: string | null;
}

export function MapView({
  atlas,
  onNodePress,
  onNodeLongPress,
  onCanvasLongPress,
  onEdgeTap,
  connectingFrom,
  selectedNodeId,
}: Props) {
  const [tick, setTick] = useState(0);

  // Canvas transform
  const panRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const panBaseRef = useRef({ x: 0, y: 0 });

  // Node positions in canvas-space
  const nodePositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    for (const node of atlas.nodes) {
      if (!nodePositions.current.has(node.id)) {
        nodePositions.current.set(node.id, { x: node.x, y: node.y });
      }
    }
  }, [atlas.nodes]);

  // Live refs so PanResponder always gets fresh callbacks & state
  const atlasRef = useRef(atlas);
  atlasRef.current = atlas;
  const onNodePressRef = useRef(onNodePress);
  onNodePressRef.current = onNodePress;
  const onNodeLongPressRef = useRef(onNodeLongPress);
  onNodeLongPressRef.current = onNodeLongPress;
  const onCanvasLongPressRef = useRef(onCanvasLongPress);
  onCanvasLongPressRef.current = onCanvasLongPress;

  // Gesture state
  const draggingNodeId = useRef<string | null>(null);
  const didDrag = useRef(false);
  const isPinching = useRef(false);
  const lastTouchDist = useRef<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const grantNodeRef = useRef<AtlasNode | null>(null); // node touched on grant
  const grantPos = useRef({ x: 0, y: 0 }); // locationX/Y at grant

  // Convert view-local coordinates → canvas coordinates
  function toCanvas(vx: number, vy: number) {
    return {
      x: (vx - panRef.current.x) / scaleRef.current,
      y: (vy - panRef.current.y) / scaleRef.current,
    };
  }

  // Hit-test using view-local coordinates (locationX/locationY)
  function getNodeAt(vx: number, vy: number): AtlasNode | null {
    const cp = toCanvas(vx, vy);
    const nodes = atlasRef.current.nodes;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const pos = nodePositions.current.get(node.id) ?? { x: node.x, y: node.y };
      const dx = cp.x - pos.x;
      const dy = cp.y - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < NODE_RADIUS + 6) return node;
    }
    return null;
  }

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function touchDist(
    t1: { pageX: number; pageY: number },
    t2: { pageX: number; pageY: number }
  ) {
    const dx = t1.pageX - t2.pageX;
    const dy = t1.pageY - t2.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (e) => {
        const touches = e.nativeEvent.touches;
        isPinching.current = false;
        didDrag.current = false;
        lastTouchDist.current = null;
        draggingNodeId.current = null;
        grantNodeRef.current = null;
        // Always snapshot pan so any subsequent canvas-pan uses the right base
        panBaseRef.current = { ...panRef.current };

        if (touches.length !== 1) return;

        // Use locationX/Y — these are relative to the MapView, not the screen
        const lx = e.nativeEvent.locationX;
        const ly = e.nativeEvent.locationY;
        grantPos.current = { x: lx, y: ly };

        const node = getNodeAt(lx, ly);
        grantNodeRef.current = node;

        if (node) {
          draggingNodeId.current = node.id;
          // Long-press on a node → edit it (800ms so connect taps don't misfire)
          longPressTimer.current = setTimeout(() => {
            if (!didDrag.current) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onNodeLongPressRef.current(node);
              draggingNodeId.current = null;
              grantNodeRef.current = null;
            }
          }, 800);
        } else {
          // Long-press on empty canvas → add node
          longPressTimer.current = setTimeout(() => {
            if (!didDrag.current) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const cp = toCanvas(lx, ly);
              onCanvasLongPressRef.current?.(cp.x, cp.y);
            }
          }, 700);
        }
      },

      onPanResponderMove: (e, gs) => {
        const touches = e.nativeEvent.touches;

        // ── Pinch to zoom ────────────────────────────────────────────────────
        if (touches.length === 2) {
          isPinching.current = true;
          draggingNodeId.current = null;
          clearLongPress();
          const d = touchDist(touches[0], touches[1]);
          if (lastTouchDist.current !== null) {
            const factor = d / lastTouchDist.current;
            scaleRef.current = Math.max(0.25, Math.min(4, scaleRef.current * factor));
          }
          lastTouchDist.current = d;
          setTick((n) => n + 1);
          return;
        }

        lastTouchDist.current = null;

        // Only mark as dragged after 10px movement to avoid accidental drags
        const moved = Math.abs(gs.dx) > 10 || Math.abs(gs.dy) > 10;
        if (moved && !didDrag.current) {
          didDrag.current = true;
          clearLongPress();
        }
        if (!moved) return;

        // ── Drag node ────────────────────────────────────────────────────────
        if (draggingNodeId.current && !isPinching.current) {
          const lx = e.nativeEvent.locationX;
          const ly = e.nativeEvent.locationY;
          const cp = toCanvas(lx, ly);
          nodePositions.current.set(draggingNodeId.current, { x: cp.x, y: cp.y });
          setTick((n) => n + 1);
          return;
        }

        // ── Pan canvas ───────────────────────────────────────────────────────
        if (!isPinching.current) {
          panRef.current = {
            x: panBaseRef.current.x + gs.dx,
            y: panBaseRef.current.y + gs.dy,
          };
          setTick((n) => n + 1);
        }
      },

      onPanResponderRelease: (e) => {
        clearLongPress();

        if (!didDrag.current && !isPinching.current) {
          // It's a tap — use locationX/Y from the release event
          const lx = e.nativeEvent.locationX;
          const ly = e.nativeEvent.locationY;
          const node = getNodeAt(lx, ly);
          if (node) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onNodePressRef.current(node);
          }
        }

        draggingNodeId.current = null;
        isPinching.current = false;
        lastTouchDist.current = null;
        grantNodeRef.current = null;
      },

      onPanResponderTerminate: () => {
        clearLongPress();
        draggingNodeId.current = null;
        isPinching.current = false;
      },
    })
  ).current;

  // ── Render helpers ──────────────────────────────────────────────────────────
  const pan = panRef.current;
  const sc = scaleRef.current;

  function getEdgePts(edge: Atlas["edges"][0]) {
    const src = atlasRef.current.nodes.find((n) => n.id === edge.sourceId);
    const tgt = atlasRef.current.nodes.find((n) => n.id === edge.targetId);
    if (!src || !tgt) return null;
    const sp = nodePositions.current.get(src.id) ?? { x: src.x, y: src.y };
    const tp = nodePositions.current.get(tgt.id) ?? { x: tgt.x, y: tgt.y };
    return {
      x1: sp.x, y1: sp.y,
      x2: tp.x, y2: tp.y,
      mx: (sp.x + tp.x) / 2,
      my: (sp.y + tp.y) / 2,
    };
  }

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* ── SVG Edges ──────────────────────────────────────────────────────── */}
      <Svg style={StyleSheet.absoluteFill} overflow="visible">
        <Defs>
          <Marker
            id="arrow"
            markerWidth="7"
            markerHeight="7"
            refX="5"
            refY="3"
            orient="auto"
          >
            <Path d="M0,0.5 L0,5.5 L6,3 z" fill="#5B8FA8" />
          </Marker>
        </Defs>

        {atlas.edges.map((edge) => {
          const pts = getEdgePts(edge);
          if (!pts) return null;

          // Screen-space endpoints (stopping at node border)
          const dx = pts.x2 - pts.x1;
          const dy = pts.y2 - pts.y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 1) return null;
          const ux = dx / len, uy = dy / len;
          const r = NODE_RADIUS * sc;

          const ex1 = pts.x1 * sc + pan.x + r * ux;
          const ey1 = pts.y1 * sc + pan.y + r * uy;
          const ex2 = pts.x2 * sc + pan.x - r * ux;
          const ey2 = pts.y2 * sc + pan.y - r * uy;

          // Quadratic Bézier control point — offset perpendicular to the line
          const screenLen = Math.sqrt((ex2 - ex1) ** 2 + (ey2 - ey1) ** 2);
          const curvature = Math.min(55, screenLen * 0.2);
          const mx = (ex1 + ex2) / 2;
          const my = (ey1 + ey2) / 2;
          const cpx = mx - uy * curvature;
          const cpy = my + ux * curvature;

          return (
            <Path
              key={edge.id}
              d={`M ${ex1} ${ey1} Q ${cpx} ${cpy} ${ex2} ${ey2}`}
              stroke="#5B8FA8"
              strokeWidth={1.5}
              fill="none"
              markerEnd="url(#arrow)"
            />
          );
        })}
      </Svg>

      {/* ── Edge labels — positioned at the curve apex ───────────────────────── */}
      {atlas.edges.map((edge) => {
        const pts = getEdgePts(edge);
        if (!pts) return null;

        const dx = pts.x2 - pts.x1;
        const dy = pts.y2 - pts.y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return null;
        const ux = dx / len, uy = dy / len;
        const r = NODE_RADIUS * sc;

        const ex1 = pts.x1 * sc + pan.x + r * ux;
        const ey1 = pts.y1 * sc + pan.y + r * uy;
        const ex2 = pts.x2 * sc + pan.x - r * ux;
        const ey2 = pts.y2 * sc + pan.y - r * uy;
        const screenLen = Math.sqrt((ex2 - ex1) ** 2 + (ey2 - ey1) ** 2);
        const curvature = Math.min(55, screenLen * 0.2);
        const mx = (ex1 + ex2) / 2;
        const my = (ey1 + ey2) / 2;
        // Apex of quadratic Bézier = midpoint between midpoint and control point
        const apexX = (mx + (mx - uy * curvature)) / 2;
        const apexY = (my + (my + ux * curvature)) / 2;

        return (
          <TouchableOpacity
            key={`lbl-${edge.id}`}
            style={[
              styles.edgeLabel,
              { left: apexX - 36, top: apexY - 10 },
            ]}
            onPress={() => onEdgeTap?.(edge.id)}
          >
            <Text style={styles.edgeLabelText} numberOfLines={1}>
              {edge.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* ── Nodes ───────────────────────────────────────────────────────────── */}
      {atlas.nodes.map((node) => {
        const pos = nodePositions.current.get(node.id) ?? { x: node.x, y: node.y };
        const sx = pos.x * sc + pan.x;
        const sy = pos.y * sc + pan.y;
        const nodeColor = C.nodeColors[node.type];
        const isSelected = selectedNodeId === node.id;
        const isConnSrc = connectingFrom === node.id;
        const r = Math.max(22, NODE_RADIUS * sc);
        const isMediaImg = node.type === "media" && !!node.imageUri;

        return (
          <View
            key={node.id}
            style={[
              styles.node,
              {
                pointerEvents: "none" as const,
                left: sx - r,
                top: sy - r,
                width: r * 2,
                height: r * 2,
                borderRadius: r,
                backgroundColor: isMediaImg ? "transparent" : nodeColor + "1A",
                borderColor: isSelected || isConnSrc ? C.tint : nodeColor + "60",
                borderWidth: isSelected || isConnSrc ? 2.5 : 1.5,
                overflow: "hidden",
              },
            ]}
          >
            {isMediaImg ? (
              <>
                <Image
                  source={{ uri: node.imageUri! }}
                  style={{ width: r * 2, height: r * 2, position: "absolute" }}
                  resizeMode="cover"
                />
                <View style={styles.mediaLabel}>
                  <Text
                    style={[styles.nodeLabelText, {
                      color: "#fff",
                      fontSize: Math.max(8, 10 * sc),
                      maxWidth: r * 2 - 4,
                    }]}
                    numberOfLines={2}
                  >
                    {node.title}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Feather
                  name={NODE_ICONS[node.type] as any}
                  size={Math.max(10, 16 * sc)}
                  color={nodeColor}
                />
                <Text
                  style={[styles.nodeLabelText, {
                    color: C.text,
                    fontSize: Math.max(8, 10 * sc),
                    maxWidth: r * 2 + 16,
                  }]}
                  numberOfLines={2}
                >
                  {node.title}
                </Text>
              </>
            )}
          </View>
        );
      })}

      {/* ── Empty hint ──────────────────────────────────────────────────────── */}
      {atlas.nodes.length === 0 && (
        <View style={[styles.emptyHint, { pointerEvents: "none" as const }]}>
          <Feather name="plus-circle" size={32} color={C.textMuted} />
          <Text style={styles.emptyHintText}>Long-press to add a node</Text>
          <Text style={styles.emptyHintSub}>Pinch to zoom · drag to pan</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.backgroundDeep,
  },
  node: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  nodeLabelText: {
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  mediaLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  edgeLabel: {
    position: "absolute",
    backgroundColor: C.backgroundCard + "EE",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    width: 72,
    alignItems: "center",
  },
  edgeLabelText: {
    fontSize: 9,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  emptyHint: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    alignItems: "center",
    gap: 8,
  },
  emptyHintText: {
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  emptyHintSub: {
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
});
