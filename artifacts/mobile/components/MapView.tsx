import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  TouchableOpacity,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Line, Defs, Marker, Path } from "react-native-svg";
import { Atlas, AtlasNode, NODE_ICONS } from "@/types/atlas";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const C = Colors.dark;
const NODE_RADIUS = 32;

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
  // ── Transform state ──────────────────────────────────────────────────────────
  const [tick, setTick] = useState(0); // force re-render of node positions
  const panRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const lastPanBase = useRef({ x: 0, y: 0 });

  // ── Node positions (persisted across renders via ref) ────────────────────────
  const nodePositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Seed positions for nodes that don't have an entry yet
  useEffect(() => {
    for (const node of atlas.nodes) {
      if (!nodePositions.current.has(node.id)) {
        nodePositions.current.set(node.id, { x: node.x, y: node.y });
      }
    }
  }, [atlas.nodes]);

  // ── Live refs so PanResponder always reads fresh values ──────────────────────
  const atlasRef = useRef(atlas);
  atlasRef.current = atlas;
  const onNodePressRef = useRef(onNodePress);
  onNodePressRef.current = onNodePress;
  const onNodeLongPressRef = useRef(onNodeLongPress);
  onNodeLongPressRef.current = onNodeLongPress;
  const onCanvasLongPressRef = useRef(onCanvasLongPress);
  onCanvasLongPressRef.current = onCanvasLongPress;
  const connectingFromRef = useRef(connectingFrom);
  connectingFromRef.current = connectingFrom;

  // ── Pinch / drag helpers ──────────────────────────────────────────────────────
  const lastTouchDist = useRef<number | null>(null);
  const isPinching = useRef(false);
  const draggingNodeId = useRef<string | null>(null);
  const didDrag = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef({ x: 0, y: 0 });

  function screenToCanvas(sx: number, sy: number) {
    return {
      x: (sx - panRef.current.x) / scaleRef.current,
      y: (sy - panRef.current.y) / scaleRef.current,
    };
  }

  function getNodeAt(sx: number, sy: number): AtlasNode | null {
    const cp = screenToCanvas(sx, sy);
    for (const node of atlasRef.current.nodes) {
      const pos = nodePositions.current.get(node.id) ?? { x: node.x, y: node.y };
      const dx = cp.x - pos.x;
      const dy = cp.y - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < NODE_RADIUS + 8) return node;
    }
    return null;
  }

  function touchDist(
    t1: { pageX: number; pageY: number },
    t2: { pageX: number; pageY: number }
  ) {
    const dx = t1.pageX - t2.pageX;
    const dy = t1.pageY - t2.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ── PanResponder (stable ref — reads mutable refs at call time) ──────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (e) => {
        const touches = e.nativeEvent.touches;
        didDrag.current = false;
        isPinching.current = false;
        lastTouchDist.current = null;

        if (touches.length === 1) {
          const t = touches[0];
          touchStartPos.current = { x: t.pageX, y: t.pageY };
          const node = getNodeAt(t.pageX, t.pageY);

          if (node) {
            draggingNodeId.current = node.id;
            // Long-press → edit
            longPressTimer.current = setTimeout(() => {
              if (!didDrag.current) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onNodeLongPressRef.current(node);
                draggingNodeId.current = null;
              }
            }, 500);
          } else {
            draggingNodeId.current = null;
            lastPanBase.current = { x: panRef.current.x, y: panRef.current.y };
            // Long-press canvas → add node
            longPressTimer.current = setTimeout(() => {
              if (!didDrag.current) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const cp = screenToCanvas(t.pageX, t.pageY);
                onCanvasLongPressRef.current?.(cp.x, cp.y);
              }
            }, 600);
          }
        }
      },

      onPanResponderMove: (e, gs) => {
        const touches = e.nativeEvent.touches;

        if (touches.length === 2) {
          isPinching.current = true;
          draggingNodeId.current = null;
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
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

        const moved =
          Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4;
        if (moved && !didDrag.current) {
          didDrag.current = true;
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }

        if (!moved) return;

        if (draggingNodeId.current && !isPinching.current) {
          const t = touches[0];
          const cp = screenToCanvas(t.pageX, t.pageY);
          nodePositions.current.set(draggingNodeId.current, {
            x: cp.x,
            y: cp.y,
          });
          setTick((n) => n + 1);
        } else if (!isPinching.current) {
          panRef.current = {
            x: lastPanBase.current.x + gs.dx,
            y: lastPanBase.current.y + gs.dy,
          };
          setTick((n) => n + 1);
        }
      },

      onPanResponderRelease: (e) => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }

        const touches = e.nativeEvent.changedTouches;

        if (!didDrag.current && !isPinching.current && touches.length === 1) {
          const t = touches[0];
          const node = getNodeAt(t.pageX, t.pageY);
          if (node) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onNodePressRef.current(node);
          }
        }

        draggingNodeId.current = null;
        isPinching.current = false;
        lastTouchDist.current = null;
        didDrag.current = false;
      },
    })
  ).current;

  // ── Edge path helpers ─────────────────────────────────────────────────────────
  function getEdgePts(edge: (typeof atlas.edges)[0]) {
    const src = atlas.nodes.find((n) => n.id === edge.sourceId);
    const tgt = atlas.nodes.find((n) => n.id === edge.targetId);
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

  const pan = panRef.current;
  const sc = scaleRef.current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* SVG edges */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Marker
            id="arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <Path d="M0,0 L0,6 L8,3 z" fill={C.borderMid} />
          </Marker>
        </Defs>

        {atlas.edges.map((edge) => {
          const pts = getEdgePts(edge);
          if (!pts) return null;
          const dx = pts.x2 - pts.x1;
          const dy = pts.y2 - pts.y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 1) return null;
          const ux = dx / len, uy = dy / len;
          const ex1 = pts.x1 * sc + pan.x + NODE_RADIUS * ux * sc;
          const ey1 = pts.y1 * sc + pan.y + NODE_RADIUS * uy * sc;
          const ex2 = pts.x2 * sc + pan.x - NODE_RADIUS * ux * sc;
          const ey2 = pts.y2 * sc + pan.y - NODE_RADIUS * uy * sc;
          return (
            <Line
              key={edge.id}
              x1={ex1} y1={ey1} x2={ex2} y2={ey2}
              stroke={C.borderMid}
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
              strokeDasharray="4 3"
            />
          );
        })}
      </Svg>

      {/* Edge labels */}
      {atlas.edges.map((edge) => {
        const pts = getEdgePts(edge);
        if (!pts) return null;
        const lx = pts.mx * sc + pan.x;
        const ly = pts.my * sc + pan.y;
        return (
          <TouchableOpacity
            key={`lbl-${edge.id}`}
            style={[styles.edgeLabel, { left: lx - 36, top: ly - 10 }]}
            onPress={() => onEdgeTap?.(edge.id)}
          >
            <Text style={styles.edgeLabelText}>{edge.label}</Text>
          </TouchableOpacity>
        );
      })}

      {/* Nodes */}
      {atlas.nodes.map((node) => {
        const pos = nodePositions.current.get(node.id) ?? { x: node.x, y: node.y };
        const sx = pos.x * sc + pan.x;
        const sy = pos.y * sc + pan.y;
        const nodeColor = C.nodeColors[node.type];
        const isSelected = selectedNodeId === node.id;
        const isConnSrc = connectingFrom === node.id;
        const r = Math.max(20, NODE_RADIUS * sc);
        const isMedia = node.type === "media" && !!node.imageUri;

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
                backgroundColor: isMedia ? "transparent" : nodeColor + "18",
                borderColor: isSelected || isConnSrc
                  ? C.tint
                  : nodeColor + "60",
                borderWidth: isSelected || isConnSrc ? 2.5 : 1.5,
                overflow: "hidden",
              },
            ]}
          >
            {isMedia ? (
              <>
                <Image
                  source={{ uri: node.imageUri! }}
                  style={{
                    width: r * 2,
                    height: r * 2,
                    position: "absolute",
                    borderRadius: r,
                  }}
                  resizeMode="cover"
                />
                {/* Title overlay */}
                <View style={styles.mediaOverlay}>
                  <Text
                    style={[
                      styles.nodeLabel,
                      {
                        color: "#fff",
                        fontSize: Math.max(8, 10 * sc),
                        maxWidth: r * 2 - 4,
                      },
                    ]}
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
                  style={[
                    styles.nodeLabel,
                    {
                      color: C.text,
                      fontSize: Math.max(8, 10 * sc),
                      maxWidth: r * 2 + 16,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {node.title}
                </Text>
              </>
            )}
          </View>
        );
      })}

      {/* Empty hint */}
      {atlas.nodes.length === 0 && (
        <View
          style={[styles.emptyHint, { pointerEvents: "none" as const }]}
        >
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
    overflow: "hidden",
  },
  node: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  mediaOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  nodeLabel: {
    fontFamily: "Inter_500Medium",
    textAlign: "center",
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
