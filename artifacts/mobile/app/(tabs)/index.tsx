import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Atlas } from "@/types/atlas";
import { getAllAtlases, deleteAtlas } from "@/storage/atlasStorage";
import { AtlasCard } from "@/components/AtlasCard";
import Colors from "@/constants/colors";

const C = Colors.dark;

export default function HomeScreen() {
  const [atlases, setAtlases] = useState<Atlas[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getAllAtlases().then((data) => {
        if (active) {
          setAtlases(data);
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }, [])
  );

  async function handleDelete(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeletingId(id);
    await deleteAtlas(id);
    setAtlases((prev) => prev.filter((a) => a.id !== id));
    setDeletingId(null);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Deep Dive Atlas</Text>
          <Text style={styles.headerSub}>
            {atlases.length > 0
              ? `${atlases.length} knowledge map${atlases.length !== 1 ? "s" : ""}`
              : "Your knowledge maps"}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/atlas/create");
          }}
          style={styles.newBtn}
        >
          <Feather name="plus" size={20} color={C.tint} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.tint} />
        </View>
      ) : atlases.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Feather name="map" size={40} color={C.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No atlases yet</Text>
          <Text style={styles.emptyText}>
            Create your first atlas to start mapping a topic, idea, or rabbit hole.
          </Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/atlas/create");
            }}
            style={styles.emptyBtn}
          >
            <Feather name="plus" size={16} color={C.tint} />
            <Text style={styles.emptyBtnText}>Create Atlas</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={atlases}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <AtlasCard
                atlas={item}
                onPress={() => router.push(`/atlas/${item.id}`)}
              />
            </View>
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: C.text,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  newBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.tintGlow,
    borderWidth: 1,
    borderColor: C.tint + "30",
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  emptyText: {
    fontSize: 14,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.tintGlow,
    borderWidth: 1,
    borderColor: C.tint + "40",
    marginTop: 8,
  },
  emptyBtnText: {
    color: C.tint,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  cardWrap: {},
});
