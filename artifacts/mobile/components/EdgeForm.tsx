import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { AtlasNode, RelationshipLabel, RELATIONSHIP_LABELS } from "@/types/atlas";
import Colors from "@/constants/colors";

const C = Colors.dark;

interface Props {
  sourceNode: AtlasNode;
  targetNode: AtlasNode;
  onSave: (label: RelationshipLabel) => void;
  onCancel: () => void;
}

export function EdgeForm({ sourceNode, targetNode, onSave, onCancel }: Props) {
  const [selected, setSelected] = useState<RelationshipLabel>("related to");

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} style={styles.headerBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Create Link</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSave(selected);
          }}
          style={styles.headerBtn}
        >
          <Text style={styles.saveText}>Link</Text>
        </Pressable>
      </View>

      <View style={styles.preview}>
        <View style={styles.nodeChip}>
          <View style={[styles.nodeDot, { backgroundColor: C.nodeColors[sourceNode.type] }]} />
          <Text style={styles.nodeChipText} numberOfLines={1}>
            {sourceNode.title}
          </Text>
        </View>
        <Feather name="arrow-right" size={16} color={C.textMuted} />
        <View style={[styles.nodeChip, styles.nodeChipTarget]}>
          <Text style={styles.selectedLabel}>{selected}</Text>
        </View>
        <Feather name="arrow-right" size={16} color={C.textMuted} />
        <View style={styles.nodeChip}>
          <View style={[styles.nodeDot, { backgroundColor: C.nodeColors[targetNode.type] }]} />
          <Text style={styles.nodeChipText} numberOfLines={1}>
            {targetNode.title}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Relationship</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {RELATIONSHIP_LABELS.map((label) => (
          <Pressable
            key={label}
            onPress={() => {
              setSelected(label);
              Haptics.selectionAsync();
            }}
            style={[
              styles.labelChip,
              selected === label && styles.labelChipSelected,
            ]}
          >
            {selected === label && (
              <Feather name="check" size={14} color={C.tint} />
            )}
            <Text
              style={[
                styles.labelText,
                selected === label && styles.labelTextSelected,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  headerBtn: { minWidth: 60 },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  cancelText: {
    fontSize: 16,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  saveText: {
    fontSize: 16,
    color: C.tint,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
  },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
    flexWrap: "wrap",
    backgroundColor: C.backgroundCard,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  nodeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  nodeChipTarget: {
    justifyContent: "center",
  },
  nodeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nodeChipText: {
    fontSize: 13,
    color: C.text,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  selectedLabel: {
    fontSize: 13,
    color: C.tint,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  list: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 40,
  },
  labelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: C.backgroundCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  labelChipSelected: {
    borderColor: C.tint + "60",
    backgroundColor: C.tintGlow,
  },
  labelText: {
    fontSize: 15,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  labelTextSelected: {
    color: C.tint,
    fontFamily: "Inter_500Medium",
  },
});
