import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  TouchableOpacity,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Line, Defs, Marker, Path } from "react-native-svg";
import { Atlas, AtlasNode, NODE_ICONS } from "@/types/atlas";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const C = Colors.dark;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface Props {
  atlas: Atlas;
  onNodePress: (node: AtlasNode) => void;
  onNodeLongPress: (node: AtlasNode) => void;
  onCanvasLongPress?: (x: number, y: number) => void;
  onEdgeTap?: (edgeId: string) => void;
  connectingFrom?: string | null;
  selectedNodeId?: string | null;
}

const NODE_RADIUS = 32;

export function MapView({
  atlas,
  onNodePress,
  onNodeLongPress,
  onCanvasLongPress,
  onEdgeTap,
  connectingFrom,
  selectedNodeId,
}: Props) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const panRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const lastTouchDist = useRef<number | null>(null);
  const isPinching = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const draggingNodeId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didDrag = useRef(false);

  const nodePositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  for (const node of atlas.nodes) {
    if (!nodePositions.current.has(node.id)) {
      nodePositions.current.set(node.id, { x: node.x, y: node.y });
    }
  }

  function screenToCanvas(sx: number, sy: number) {
    return {
      x: (sx - panRef.current.x) / scaleRef.current,
      y: (sy - panRef.current.y) / scaleRef.current,
    };
  }

  function getNodeAt(sx: number, sy: number): AtlasNode | null {
    const canvasP = screenToCanvas(sx, sy);
    for (const node of atlas.nodes) {
      const pos = nodePositions.current.get(node.id) ?? { x: node.x, y: node.y };
      const dx = canvasP.x - pos.x;
      const dy = canvasP.y - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < NODE_RADIUS + 8) {
        return node;
      }
    }
    return null;
  }

  function dist(t1: { pageX: number; pageY: number }, t2: { pageX: number; pageY: number }) {
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
        if (touches.length === 1) {
          const touch = touches[0];
          const node = getNodeAt(touch.pageX, touch.pageY);
          if (node) {
            draggingNodeId.current = node.id;
            setDraggingId(node.id);
            didDrag.current = false;
            longPressTimer.current = setTimeout(() => {
              if (!didDrag.current) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onNodeLongPress(node);
                draggingNodeId.current = null;
                setDraggingId(null);
              }
            }, 500);
          } else {
            draggingNodeId.current = null;
            lastPan.current = { x: panRef.current.x, y: panRef.current.y };
            longPressTimer.current = setTimeout(() => {
              if (!didDrag.current && onCanvasLongPress) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const cp = screenToCanvas(touch.pageX, touch.pageY);
                onCanvasLongPress(cp.x, cp.y);
              }
            }, 600);
          }
        }
      },
      onPanResponderMove: (e, gs) => {
        const touches = e.nativeEvent.touches;
        if (touches.length === 2) {
          isPinching.current = true;
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
          const d = dist(touches[0], touches[1]);
          if (lastTouchDist.current !== null) {
            const delta = d / lastTouchDist.current;
            const newScale = Math.max(0.3, Math.min(3, scaleRef.current * delta));
            scaleRef.current = newScale;
            setScale(newScale);
          }
          lastTouchDist.current = d;
          draggingNodeId.current = null;
          setDraggingId(null);
        } else if (touches.length === 1) {
          lastTouchDist.current = null;
          if (Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4) {
            didDrag.current = true;
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
          }
          if (draggingNodeId.current) {
            const touch = touches[0];
            const cp = screenToCanvas(touch.pageX, touch.pageY);
            nodePositions.current.set(draggingNodeId.current, { x: cp.x, y: cp.y });
            setScale((s) => s);
          } else if (!isPinching.current) {
            const newX = lastPan.current.x + gs.dx;
            const newY = lastPan.current.y + gs.dy;
            panRef.current = { x: newX, y: newY };
            setPan({ x: newX, y: newY });
          }
        }
      },
      onPanResponderRelease: (e, gs) => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        const touches = e.nativeEvent.changedTouches;
        if (!didDrag.current && !isPinching.current && touches.length === 1) {
          const touch = touches[0];
          const node = getNodeAt(touch.pageX, touch.pageY);
          if (node) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onNodePress(node);
          }
        }
        if (draggingNodeId.current) {
          const nodeId = draggingNodeId.current;
          const pos = nodePositions.current.get(nodeId);
          if (pos) {
            // persist happens via parent
          }
        }
        draggingNodeId.current = null;
        setDraggingId(null);
        isPinching.current = false;
        lastTouchDist.current = null;
        didDrag.current = false;
      },
    })
  ).current;

  const getEdgePath = (edge: typeof atlas.edges[0]) => {
    const src = atlas.nodes.find((n) => n.id === edge.sourceId);
    const tgt = atlas.nodes.find((n) => n.id === edge.targetId);
    if (!src || !tgt) return null;
    const sp = nodePositions.current.get(src.id) ?? { x: src.x, y: src.y };
    const tp = nodePositions.current.get(tgt.id) ?? { x: tgt.x, y: tgt.y };
    return { x1: sp.x, y1: sp.y, x2: tp.x, y2: tp.y, mx: (sp.x + tp.x) / 2, my: (sp.y + tp.y) / 2 };
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
      >
        <Defs>
          <Marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <Path d="M0,0 L0,6 L8,3 z" fill={C.borderMid} />
          </Marker>
        </Defs>
        {atlas.edges.map((edge) => {
          const pts = getEdgePath(edge);
          if (!pts) return null;
          const dx = pts.x2 - pts.x1;
          const dy = pts.y2 - pts.y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 1) return null;
          const ux = dx / len;
          const uy = dy / len;
          const ex1 = pts.x1 * scaleRef.current + pan.x + NODE_RADIUS * ux * scaleRef.current;
          const ey1 = pts.y1 * scaleRef.current + pan.y + NODE_RADIUS * uy * scaleRef.current;
          const ex2 = pts.x2 * scaleRef.current + pan.x - NODE_RADIUS * ux * scaleRef.current;
          const ey2 = pts.y2 * scaleRef.current + pan.y - NODE_RADIUS * uy * scaleRef.current;
          return (
            <React.Fragment key={edge.id}>
              <Line
                x1={ex1}
                y1={ey1}
                x2={ex2}
                y2={ey2}
                stroke={C.borderMid}
                strokeWidth={1.5}
                markerEnd="url(#arrow)"
                strokeDasharray="4 3"
              />
            </React.Fragment>
          );
        })}
      </Svg>

      {atlas.edges.map((edge) => {
        const pts = getEdgePath(edge);
        if (!pts) return null;
        const sx = pts.mx * scaleRef.current + pan.x;
        const sy = pts.my * scaleRef.current + pan.y;
        return (
          <TouchableOpacity
            key={`label-${edge.id}`}
            style={[styles.edgeLabel, { left: sx - 36, top: sy - 10 }]}
            onPress={() => onEdgeTap?.(edge.id)}
          >
            <Text style={styles.edgeLabelText}>{edge.label}</Text>
          </TouchableOpacity>
        );
      })}

      {atlas.nodes.map((node) => {
        const pos = nodePositions.current.get(node.id) ?? { x: node.x, y: node.y };
        const sx = pos.x * scaleRef.current + pan.x;
        const sy = pos.y * scaleRef.current + pan.y;
        const nodeColor = C.nodeColors[node.type];
        const isSelected = selectedNodeId === node.id;
        const isConnecting = connectingFrom === node.id;
        const r = NODE_RADIUS * scaleRef.current;

        return (
          <View
            key={node.id}
            style={[
              styles.node,
              { pointerEvents: "none" as const,
                left: sx - r,
                top: sy - r,
                width: r * 2,
                height: r * 2,
                borderRadius: r,
                backgroundColor: nodeColor + "18",
                borderColor: isSelected || isConnecting ? C.tint : nodeColor + "60",
                borderWidth: isSelected ? 2.5 : 1.5,
              },
            ]}
          >
            <Feather
              name={NODE_ICONS[node.type] as any}
              size={Math.max(10, 16 * scaleRef.current)}
              color={nodeColor}
            />
            <Text
              style={[
                styles.nodeLabel,
                {
                  color: C.text,
                  fontSize: Math.max(8, 11 * scaleRef.current),
                  maxWidth: r * 2 + 20,
                },
              ]}
              numberOfLines={2}
            >
              {node.title}
            </Text>
          </View>
        );
      })}

      {atlas.nodes.length === 0 && (
        <View style={[styles.emptyHint, { pointerEvents: "none" as const }]}>
          <Feather name="plus-circle" size={32} color={C.textMuted} />
          <Text style={styles.emptyHintText}>Long press to add a node</Text>
          <Text style={styles.emptyHintSub}>Pinch to zoom · Drag to pan</Text>
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
