import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { AtlasNode, NodeType, NODE_TYPES, NODE_LABELS, NODE_ICONS, RELATIONSHIP_LABELS } from "@/types/atlas";
import { NodeTypeBadge } from "@/components/ui/NodeTypeBadge";
import Colors from "@/constants/colors";

const C = Colors.dark;

interface Props {
  initialNode?: Partial<AtlasNode>;
  onSave: (data: {
    type: NodeType;
    title: string;
    note: string;
    tags: string[];
    imageUri?: string;
  }) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function NodeForm({ initialNode, onSave, onCancel, onDelete }: Props) {
  const [type, setType] = useState<NodeType>(initialNode?.type ?? "concept");
  const [title, setTitle] = useState(initialNode?.title ?? "");
  const [note, setNote] = useState(initialNode?.note ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(initialNode?.tags ?? []);
  const [imageUri, setImageUri] = useState<string | undefined>(initialNode?.imageUri);

  const nodeColor = C.nodeColors[type];

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri);
    }
  }

  function handleSave() {
    if (!title.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSave({ type, title: title.trim(), note: note.trim(), tags, imageUri });
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <View style={styles.header}>
        <Pressable onPress={onCancel} style={styles.headerBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {initialNode?.id ? "Edit Node" : "New Node"}
        </Text>
        <Pressable
          onPress={handleSave}
          style={[styles.headerBtn, !title.trim() && styles.disabledBtn]}
          disabled={!title.trim()}
        >
          <Text style={[styles.saveText, !title.trim() && styles.disabledText]}>
            Save
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionLabel}>Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
          {NODE_TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                setType(t);
                Haptics.selectionAsync();
              }}
              style={[
                styles.typeChip,
                {
                  borderColor: t === type ? C.nodeColors[t] : C.borderSubtle,
                  backgroundColor: t === type ? C.nodeColors[t] + "20" : "transparent",
                },
              ]}
            >
              <Feather name={NODE_ICONS[t] as any} size={13} color={t === type ? C.nodeColors[t] : C.textMuted} />
              <Text style={[styles.typeChipText, { color: t === type ? C.nodeColors[t] : C.textMuted }]}>
                {NODE_LABELS[t]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>Title</Text>
        <TextInput
          style={[styles.input, styles.titleInput, { borderColor: nodeColor + "40" }]}
          value={title}
          onChangeText={setTitle}
          placeholder="Name this node..."
          placeholderTextColor={C.textMuted}
          returnKeyType="next"
          autoFocus={!initialNode?.id}
        />

        <Text style={styles.sectionLabel}>Notes</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          value={note}
          onChangeText={setNote}
          placeholder="Add context, observations, or details..."
          placeholderTextColor={C.textMuted}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.sectionLabel}>Tags</Text>
        <View style={styles.tagInputRow}>
          <TextInput
            style={[styles.input, styles.tagInput]}
            value={tagInput}
            onChangeText={setTagInput}
            placeholder="Add tag..."
            placeholderTextColor={C.textMuted}
            returnKeyType="done"
            onSubmitEditing={addTag}
            autoCapitalize="none"
          />
          <Pressable onPress={addTag} style={styles.addTagBtn}>
            <Feather name="plus" size={16} color={C.tint} />
          </Pressable>
        </View>
        {tags.length > 0 && (
          <View style={styles.tagList}>
            {tags.map((tag) => (
              <Pressable key={tag} onPress={() => removeTag(tag)} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
                <Feather name="x" size={11} color={C.textSecondary} />
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.sectionLabel}>Attachment</Text>
        <Pressable onPress={pickImage} style={styles.imagePicker}>
          {imageUri ? (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <Pressable
                onPress={() => setImageUri(undefined)}
                style={styles.removeImage}
              >
                <Feather name="x" size={14} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Feather name="image" size={22} color={C.textMuted} />
              <Text style={styles.imagePlaceholderText}>Tap to attach screenshot or image</Text>
            </View>
          )}
        </Pressable>

        {onDelete && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onDelete();
            }}
            style={styles.deleteBtn}
          >
            <Feather name="trash-2" size={16} color="#F06E6E" />
            <Text style={styles.deleteText}>Delete Node</Text>
          </Pressable>
        )}
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
  saveText: {
    fontSize: 16,
    color: C.tint,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
  },
  disabledBtn: { opacity: 0.4 },
  disabledText: { color: C.textMuted },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 8, paddingBottom: 60 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 4,
  },
  typeRow: { flexGrow: 0, marginBottom: 4 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  typeChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
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
  titleInput: { marginBottom: 4 },
  noteInput: {
    minHeight: 100,
    paddingTop: 12,
    lineHeight: 22,
  },
  tagInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tagInput: { flex: 1 },
  addTagBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: C.backgroundCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  tagList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.backgroundElevated,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
    color: C.tint,
    fontFamily: "Inter_400Regular",
  },
  imagePicker: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderStyle: "dashed",
    overflow: "hidden",
    minHeight: 100,
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  imagePlaceholderText: {
    fontSize: 13,
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  imagePreviewWrap: { position: "relative" },
  imagePreview: { width: "100%", height: 180, resizeMode: "cover" },
  removeImage: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#F06E6E18",
    borderWidth: 1,
    borderColor: "#F06E6E30",
  },
  deleteText: {
    color: "#F06E6E",
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
});
