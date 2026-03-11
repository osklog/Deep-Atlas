import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { NodeType, NODE_ICONS, NODE_LABELS } from "@/types/atlas";
import Colors from "@/constants/colors";

const C = Colors.dark;

interface Props {
  type: NodeType;
  size?: "sm" | "md";
}

export function NodeTypeBadge({ type, size = "md" }: Props) {
  const color = C.nodeColors[type];
  const icon = NODE_ICONS[type];
  const label = NODE_LABELS[type];
  const isSmall = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: color + "20", borderColor: color + "40" },
        isSmall && styles.badgeSm,
      ]}
    >
      <Feather
        name={icon as any}
        size={isSmall ? 10 : 12}
        color={color}
      />
      <Text
        style={[
          styles.label,
          { color },
          isSmall && styles.labelSm,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  labelSm: {
    fontSize: 10,
  },
});
