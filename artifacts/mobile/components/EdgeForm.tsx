import React, { useState } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet, TextInput,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { AtlasNode, SUGGESTED_LABELS } from "@/types/atlas";
import Colors from "@/constants/colors";

const C = Colors.dark;

interface Props {
  sourceNode: AtlasNode;
  targetNode: AtlasNode;
  onSave: (label: string) => void;
  onCancel: () => void;
}

export function EdgeForm({ sourceNode, targetNode, onSave, onCancel }: Props) {
  const [selected, setSelected] = useState("related to");
  const [custom, setCustom] = useState("");

  const effectiveLabel = custom.trim() || selected || "related to";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <View style={styles.header}>
        <Pressable onPress={onCancel} style={styles.headerBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Create Link</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSave(effectiveLabel);
          }}
          style={styles.headerBtn}
        >
          <Text style={styles.saveText}>Link</Text>
        </Pressable>
      </View>

      <View style={styles.preview}>
        <View style={styles.nodeChip}>
          <View style={[styles.nodeDot, { backgroundColor: C.nodeColors[sourceNode.type] }]} />
          <Text style={styles.nodeChipText} numberOfLines={1}>{sourceNode.title}</Text>
        </View>
        <Feather name="arrow-right" size={16} color={C.textMuted} />
        <View style={styles.labelChipCenter}>
          <Text style={styles.selectedLabel} numberOfLines={1}>{effectiveLabel}</Text>
        </View>
        <Feather name="arrow-right" size={16} color={C.textMuted} />
        <View style={styles.nodeChip}>
          <View style={[styles.nodeDot, { backgroundColor: C.nodeColors[targetNode.type] }]} />
          <Text style={styles.nodeChipText} numberOfLines={1}>{targetNode.title}</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Custom label</Text>
      <View style={styles.customRow}>
        <TextInput
          style={styles.customInput}
          value={custom}
          onChangeText={(t) => { setCustom(t); setSelected(""); }}
          placeholder="Type a custom relationship..."
          placeholderTextColor={C.textMuted}
          returnKeyType="done"
          autoCapitalize="none"
        />
        {custom.length > 0 && (
          <Pressable onPress={() => setCustom("")} style={styles.clearBtn}>
            <Feather name="x" size={14} color={C.textMuted} />
          </Pressable>
        )}
      </View>

      <Text style={styles.sectionLabel}>Suggested</Text>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
        {SUGGESTED_LABELS.map((label) => (
          <Pressable
            key={label}
            onPress={() => {
              setSelected(label);
              setCustom("");
              Haptics.selectionAsync();
            }}
            style={[
              styles.chip,
              selected === label && !custom && styles.chipSelected,
            ]}
          >
            {selected === label && !custom && (
              <Feather name="check" size={14} color={C.tint} />
            )}
            <Text
              style={[
                styles.chipText,
                selected === label && !custom && styles.chipTextSelected,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  headerBtn: { minWidth: 60 },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: C.text },
  cancelText: { fontSize: 16, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  saveText: { fontSize: 16, color: C.tint, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  preview: {
    flexDirection: "row", alignItems: "center", gap: 8, padding: 16,
    flexWrap: "wrap", backgroundColor: C.backgroundCard,
    marginHorizontal: 16, marginTop: 16, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  nodeChip: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  labelChipCenter: { justifyContent: "center", alignItems: "center" },
  nodeDot: { width: 8, height: 8, borderRadius: 4 },
  nodeChipText: { fontSize: 13, color: C.text, fontFamily: "Inter_500Medium", flex: 1 },
  selectedLabel: { fontSize: 13, color: C.tint, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  sectionLabel: {
    fontSize: 12, fontFamily: "Inter_500Medium", color: C.textMuted,
    textTransform: "uppercase", letterSpacing: 0.8,
    marginTop: 20, marginBottom: 8, paddingHorizontal: 16,
  },
  customRow: {
    flexDirection: "row", alignItems: "center", marginHorizontal: 16, gap: 8,
  },
  customInput: {
    flex: 1, backgroundColor: C.backgroundCard, borderRadius: 10,
    borderWidth: 1, borderColor: C.borderSubtle,
    paddingHorizontal: 14, paddingVertical: 12,
    color: C.text, fontFamily: "Inter_400Regular", fontSize: 15,
  },
  clearBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.backgroundCard, borderWidth: 1, borderColor: C.borderSubtle,
    alignItems: "center", justifyContent: "center",
  },
  scroll: { flex: 1 },
  list: { paddingHorizontal: 16, gap: 8, paddingBottom: 40 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10,
    backgroundColor: C.backgroundCard, borderWidth: 1, borderColor: C.borderSubtle,
  },
  chipSelected: { borderColor: C.tint + "60", backgroundColor: C.tintGlow },
  chipText: { fontSize: 15, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  chipTextSelected: { color: C.tint, fontFamily: "Inter_500Medium" },
});
