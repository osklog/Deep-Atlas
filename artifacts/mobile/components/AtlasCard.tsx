import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Atlas } from "@/types/atlas";
import { PressableCard } from "@/components/ui/PressableCard";
import Colors from "@/constants/colors";

const C = Colors.dark;

interface Props {
  atlas: Atlas;
  onPress: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function AtlasCard({ atlas, onPress }: Props) {
  const nodeCount = atlas.nodes.length;
  const edgeCount = atlas.edges.length;

  return (
    <PressableCard onPress={onPress} style={styles.card}>
      <View style={styles.accentBar}>
        <View style={[styles.dot, { backgroundColor: atlas.color }]} />
        <View style={[styles.line, { backgroundColor: atlas.color + "30" }]} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {atlas.title}
        </Text>
        {atlas.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {atlas.description}
          </Text>
        ) : null}
        <View style={styles.meta}>
          <View style={styles.stat}>
            <Feather name="circle" size={12} color={C.textMuted} />
            <Text style={styles.statText}>{nodeCount} node{nodeCount !== 1 ? "s" : ""}</Text>
          </View>
          <View style={styles.stat}>
            <Feather name="git-commit" size={12} color={C.textMuted} />
            <Text style={styles.statText}>{edgeCount} link{edgeCount !== 1 ? "s" : ""}</Text>
          </View>
          <Text style={styles.date}>{formatDate(atlas.updatedAt)}</Text>
        </View>
      </View>
      <View style={styles.arrow}>
        <Feather name="chevron-right" size={18} color={C.textMuted} />
      </View>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  accentBar: {
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 20,
    borderRadius: 1,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
    lineHeight: 22,
  },
  description: {
    fontSize: 13,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
  },
  date: {
    fontSize: 11,
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
    marginLeft: "auto",
  },
  arrow: {
    justifyContent: "center",
  },
});
