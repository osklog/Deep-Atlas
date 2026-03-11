import AsyncStorage from "@react-native-async-storage/async-storage";
import { Atlas, AtlasNode, AtlasEdge } from "@/types/atlas";

const ATLASES_KEY = "deep_dive_atlas:atlases";

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function getAllAtlases(): Promise<Atlas[]> {
  try {
    const raw = await AsyncStorage.getItem(ATLASES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Atlas[];
    return parsed.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function getAtlas(id: string): Promise<Atlas | null> {
  const atlases = await getAllAtlases();
  return atlases.find((a) => a.id === id) ?? null;
}

export async function saveAtlas(atlas: Atlas): Promise<void> {
  const atlases = await getAllAtlases();
  const idx = atlases.findIndex((a) => a.id === atlas.id);
  if (idx >= 0) {
    atlases[idx] = atlas;
  } else {
    atlases.push(atlas);
  }
  await AsyncStorage.setItem(ATLASES_KEY, JSON.stringify(atlases));
}

export async function createAtlas(
  title: string,
  description: string,
  color: string
): Promise<Atlas> {
  const now = new Date().toISOString();
  const atlas: Atlas = {
    id: generateId(),
    title,
    description,
    color,
    nodes: [],
    edges: [],
    createdAt: now,
    updatedAt: now,
  };
  await saveAtlas(atlas);
  return atlas;
}

export async function updateAtlas(
  id: string,
  updates: Partial<Omit<Atlas, "id" | "createdAt">>
): Promise<Atlas | null> {
  const atlas = await getAtlas(id);
  if (!atlas) return null;
  const updated: Atlas = {
    ...atlas,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await saveAtlas(updated);
  return updated;
}

export async function deleteAtlas(id: string): Promise<void> {
  const atlases = await getAllAtlases();
  const filtered = atlases.filter((a) => a.id !== id);
  await AsyncStorage.setItem(ATLASES_KEY, JSON.stringify(filtered));
}

export async function addNode(
  atlasId: string,
  node: Omit<AtlasNode, "id" | "createdAt" | "updatedAt">
): Promise<AtlasNode | null> {
  const atlas = await getAtlas(atlasId);
  if (!atlas) return null;
  const now = new Date().toISOString();
  const newNode: AtlasNode = {
    ...node,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  atlas.nodes.push(newNode);
  atlas.updatedAt = now;
  await saveAtlas(atlas);
  return newNode;
}

export async function updateNode(
  atlasId: string,
  nodeId: string,
  updates: Partial<Omit<AtlasNode, "id" | "createdAt">>
): Promise<Atlas | null> {
  const atlas = await getAtlas(atlasId);
  if (!atlas) return null;
  const nodeIdx = atlas.nodes.findIndex((n) => n.id === nodeId);
  if (nodeIdx < 0) return null;
  atlas.nodes[nodeIdx] = {
    ...atlas.nodes[nodeIdx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  atlas.updatedAt = new Date().toISOString();
  await saveAtlas(atlas);
  return atlas;
}

export async function deleteNode(
  atlasId: string,
  nodeId: string
): Promise<Atlas | null> {
  const atlas = await getAtlas(atlasId);
  if (!atlas) return null;
  atlas.nodes = atlas.nodes.filter((n) => n.id !== nodeId);
  atlas.edges = atlas.edges.filter(
    (e) => e.sourceId !== nodeId && e.targetId !== nodeId
  );
  atlas.updatedAt = new Date().toISOString();
  await saveAtlas(atlas);
  return atlas;
}

export async function addEdge(
  atlasId: string,
  sourceId: string,
  targetId: string,
  label: AtlasEdge["label"]
): Promise<AtlasEdge | null> {
  const atlas = await getAtlas(atlasId);
  if (!atlas) return null;
  const now = new Date().toISOString();
  const edge: AtlasEdge = {
    id: generateId(),
    sourceId,
    targetId,
    label,
    createdAt: now,
  };
  atlas.edges.push(edge);
  atlas.updatedAt = now;
  await saveAtlas(atlas);
  return edge;
}

export async function deleteEdge(
  atlasId: string,
  edgeId: string
): Promise<Atlas | null> {
  const atlas = await getAtlas(atlasId);
  if (!atlas) return null;
  atlas.edges = atlas.edges.filter((e) => e.id !== edgeId);
  atlas.updatedAt = new Date().toISOString();
  await saveAtlas(atlas);
  return atlas;
}

export async function searchAll(query: string): Promise<{
  atlases: Atlas[];
  nodes: Array<{ atlasId: string; atlasTitle: string; node: AtlasNode }>;
}> {
  const q = query.toLowerCase();
  const atlases = await getAllAtlases();
  const matchingAtlases = atlases.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      (a.description?.toLowerCase().includes(q) ?? false)
  );
  const matchingNodes: Array<{
    atlasId: string;
    atlasTitle: string;
    node: AtlasNode;
  }> = [];
  for (const atlas of atlases) {
    for (const node of atlas.nodes) {
      if (
        node.title.toLowerCase().includes(q) ||
        (node.note?.toLowerCase().includes(q) ?? false) ||
        node.tags.some((t) => t.toLowerCase().includes(q))
      ) {
        matchingNodes.push({
          atlasId: atlas.id,
          atlasTitle: atlas.title,
          node,
        });
      }
    }
  }
  return { atlases: matchingAtlases, nodes: matchingNodes };
}
