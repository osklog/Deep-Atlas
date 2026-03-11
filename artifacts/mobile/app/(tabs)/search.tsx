import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { searchAll } from "@/storage/atlasStorage";
import { Atlas, AtlasNode, NODE_ICONS } from "@/types/atlas";
import { NodeTypeBadge } from "@/components/ui/NodeTypeBadge";
import Colors from "@/constants/colors";

const C = Colors.dark;

type SearchResult =
  | { kind: "atlas"; atlas: Atlas }
  | { kind: "node"; atlasId: string; atlasTitle: string; node: AtlasNode };

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const insets = useSafeAreaInsets();

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    const { atlases, nodes } = await searchAll(q.trim());
    const combined: SearchResult[] = [
      ...atlases.map((a): SearchResult => ({ kind: "atlas", atlas: a })),
      ...nodes.map((n): SearchResult => ({
        kind: "node",
        atlasId: n.atlasId,
        atlasTitle: n.atlasTitle,
        node: n.node,
      })),
    ];
    setResults(combined);
    setLoading(false);
    setSearched(true);
  }

  function renderItem({ item }: { item: SearchResult }) {
    if (item.kind === "atlas") {
      return (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/atlas/${item.atlas.id}`);
          }}
          style={styles.resultCard}
        >
          <View style={[styles.resultIcon, { backgroundColor: item.atlas.color + "20" }]}>
            <Feather name="map" size={18} color={item.atlas.color} />
          </View>
          <View style={styles.resultContent}>
            <Text style={styles.resultTitle}>{item.atlas.title}</Text>
            {item.atlas.description ? (
              <Text style={styles.resultSub} numberOfLines={1}>
                {item.atlas.description}
              </Text>
            ) : null}
            <Text style={styles.resultMeta}>
              Atlas · {item.atlas.nodes.length} nodes
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={C.textMuted} />
        </Pressable>
      );
    } else {
      return (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({
              pathname: "/atlas/[id]",
              params: { id: item.atlasId, focusNodeId: item.node.id },
            });
          }}
          style={styles.resultCard}
        >
          <View
            style={[
              styles.resultIcon,
              { backgroundColor: C.nodeColors[item.node.type] + "20" },
            ]}
          >
            <Feather
              name={NODE_ICONS[item.node.type] as any}
              size={18}
              color={C.nodeColors[item.node.type]}
            />
          </View>
          <View style={styles.resultContent}>
            <Text style={styles.resultTitle}>{item.node.title}</Text>
            {item.node.note ? (
              <Text style={styles.resultSub} numberOfLines={1}>
                {item.node.note}
              </Text>
            ) : null}
            <Text style={styles.resultMeta}>
              In: {item.atlasTitle}
            </Text>
          </View>
          <NodeTypeBadge type={item.node.type} size="sm" />
        </Pressable>
      );
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>
      <View style={styles.searchBar}>
        <Feather name="search" size={16} color={C.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={handleSearch}
          placeholder="Search atlases, nodes, tags..."
          placeholderTextColor={C.textMuted}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(""); setResults([]); setSearched(false); }}>
            <Feather name="x" size={16} color={C.textMuted} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.tint} />
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) =>
            item.kind === "atlas" ? `atlas-${item.atlas.id}` : `node-${item.node.id}`
          }
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        />
      ) : searched ? (
        <View style={styles.center}>
          <Feather name="search" size={32} color={C.textMuted} />
          <Text style={styles.emptyText}>No results for "{query}"</Text>
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.hintText}>
            Search across all your atlases and nodes
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: C.text,
    letterSpacing: -0.3,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: C.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: C.text,
    fontFamily: "Inter_400Regular",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  hintText: {
    fontSize: 14,
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 15,
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
  },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 8 },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: 12,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  resultContent: { flex: 1, gap: 2 },
  resultTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  resultSub: {
    fontSize: 13,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  resultMeta: {
    fontSize: 11,
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
});
