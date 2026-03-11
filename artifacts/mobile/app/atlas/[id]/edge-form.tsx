import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { EdgeForm } from "@/components/EdgeForm";
import { addEdge, getAtlas } from "@/storage/atlasStorage";
import { AtlasNode, RelationshipLabel } from "@/types/atlas";
import Colors from "@/constants/colors";

const C = Colors.dark;

export default function EdgeFormScreen() {
  const { id, sourceId, targetId } = useLocalSearchParams<{
    id: string;
    sourceId: string;
    targetId: string;
  }>();

  const [sourceNode, setSourceNode] = useState<AtlasNode | null>(null);
  const [targetNode, setTargetNode] = useState<AtlasNode | null>(null);

  useEffect(() => {
    getAtlas(id).then((atlas) => {
      if (!atlas) return;
      setSourceNode(atlas.nodes.find((n) => n.id === sourceId) ?? null);
      setTargetNode(atlas.nodes.find((n) => n.id === targetId) ?? null);
    });
  }, [id, sourceId, targetId]);

  async function handleSave(label: RelationshipLabel) {
    await addEdge(id, sourceId, targetId, label);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.dismiss();
  }

  if (!sourceNode || !targetNode) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.backgroundDeep }}>
        <ActivityIndicator color={C.tint} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.backgroundDeep }}>
      <EdgeForm
        sourceNode={sourceNode}
        targetNode={targetNode}
        onSave={handleSave}
        onCancel={() => router.dismiss()}
      />
    </View>
  );
}
