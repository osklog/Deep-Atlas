import React from "react";
import { View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { NodeForm } from "@/components/NodeForm";
import { addNode, updateNode, deleteNode, getAtlas } from "@/storage/atlasStorage";
import { NodeType } from "@/types/atlas";
import Colors from "@/constants/colors";

const C = Colors.dark;

export default function NodeFormScreen() {
  const { id, nodeId, spawnX, spawnY } = useLocalSearchParams<{
    id: string;
    nodeId?: string;
    spawnX?: string;
    spawnY?: string;
  }>();

  const [initialNode, setInitialNode] = React.useState<any>(undefined);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (nodeId) {
      getAtlas(id).then((atlas) => {
        if (atlas) {
          const node = atlas.nodes.find((n) => n.id === nodeId);
          setInitialNode(node);
        }
        setLoaded(true);
      });
    } else {
      setLoaded(true);
    }
  }, [id, nodeId]);

  async function handleSave(data: {
    type: NodeType;
    title: string;
    note: string;
    tags: string[];
    imageUri?: string;
  }) {
    if (nodeId) {
      await updateNode(id, nodeId, {
        type: data.type,
        title: data.title,
        note: data.note,
        tags: data.tags,
        imageUri: data.imageUri,
      });
    } else {
      const x = spawnX ? parseInt(spawnX, 10) : 150 + Math.random() * 100;
      const y = spawnY ? parseInt(spawnY, 10) : 200 + Math.random() * 100;
      await addNode(id, {
        type: data.type,
        title: data.title,
        note: data.note,
        tags: data.tags,
        imageUri: data.imageUri,
        x,
        y,
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.dismiss();
  }

  async function handleDelete() {
    if (!nodeId) return;
    await deleteNode(id, nodeId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.dismiss();
  }

  if (!loaded) return <View style={{ flex: 1, backgroundColor: C.backgroundDeep }} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.backgroundDeep }}>
      <NodeForm
        initialNode={initialNode}
        onSave={handleSave}
        onCancel={() => router.dismiss()}
        onDelete={nodeId ? handleDelete : undefined}
      />
    </View>
  );
}
