import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { createAtlas } from "@/storage/atlasStorage";
import { ATLAS_COLORS } from "@/types/atlas";
import Colors from "@/constants/colors";

const C = Colors.dark;

export default function CreateAtlasScreen() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(ATLAS_COLORS[0]);

  async function handleCreate() {
    if (!title.trim()) {
      Alert.alert("Title required", "Please enter a title for your atlas.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const atlas = await createAtlas(title.trim(), description.trim(), color);
    router.replace(`/atlas/${atlas.id}`);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.dismiss()} style={styles.headerBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New Atlas</Text>
        <Pressable onPress={handleCreate} style={styles.headerBtn}>
          <Text style={styles.createText}>Create</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={[styles.input, styles.titleInput, { borderColor: color + "50" }]}
          value={title}
          onChangeText={setTitle}
          placeholder="What are you diving into?"
          placeholderTextColor={C.textMuted}
          autoFocus
          returnKeyType="next"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.descInput]}
          value={description}
          onChangeText={setDescription}
          placeholder="Brief context or goal (optional)..."
          placeholderTextColor={C.textMuted}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Color</Text>
        <View style={styles.colorGrid}>
          {ATLAS_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => {
                setColor(c);
                Haptics.selectionAsync();
              }}
              style={[
                styles.colorChip,
                { backgroundColor: c + "30", borderColor: c },
                color === c && styles.colorChipSelected,
              ]}
            >
              <View style={[styles.colorDot, { backgroundColor: c }]} />
            </Pressable>
          ))}
        </View>

        <View style={[styles.preview, { borderColor: color + "30" }]}>
          <View style={[styles.previewDot, { backgroundColor: color }]} />
          <View>
            <Text style={styles.previewTitle}>{title || "Atlas Title"}</Text>
            <Text style={styles.previewSub}>
              {description || "Your knowledge map starts here"}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  createText: {
    fontSize: 16,
    color: C.tint,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
  },
  disabled: { opacity: 0.4 },
  disabledText: { color: C.textMuted },
  content: { padding: 20, gap: 8, paddingBottom: 40 },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    backgroundColor: C.backgroundCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  titleInput: { fontSize: 17, fontFamily: "Inter_500Medium" },
  descInput: { minHeight: 80, paddingTop: 12, lineHeight: 22 },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  colorChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  colorChipSelected: {
    borderWidth: 2.5,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: C.backgroundCard,
    borderWidth: 1,
  },
  previewDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  previewTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  previewSub: {
    fontSize: 13,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
