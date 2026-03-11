import AsyncStorage from "@react-native-async-storage/async-storage";
import { Atlas, AtlasNode, AtlasEdge, AtlasSchema, NODE_TYPE_VALUES } from "@/types/atlas";

const ATLASES_KEY = "deep_dive_atlas:atlases";
const STORAGE_VERSION_KEY = "deep_dive_atlas:version";
const CURRENT_VERSION = 2;

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function migrateAtlas(raw: Record<string, unknown>): Atlas {
  const result = AtlasSchema.safeParse(raw);
  if (result.success) return result.data;

  const now = new Date().toISOString();
  return {
    id: typeof raw.id === "string" ? raw.id : generateId(),
    title: typeof raw.title === "string" && raw.title ? raw.title : "Untitled Atlas",
    description: typeof raw.description === "string" ? raw.description : "",
    color: typeof raw.color === "string" ? raw.color : "#C9A96E",
    nodes: Array.isArray(raw.nodes)
      ? raw.nodes.map((n: any) => ({
          id: typeof n?.id === "string" ? n.id : generateId(),
          type: NODE_TYPE_VALUES.includes(n?.type) ? n.type : "concept",
          title: typeof n?.title === "string" && n.title ? n.title : "Untitled",
          note: typeof n?.note === "string" ? n.note : "",
          tags: Array.isArray(n?.tags) ? n.tags.filter((t: unknown) => typeof t === "string") : [],
          imageUri: typeof n?.imageUri === "string" ? n.imageUri : undefined,
          x: typeof n?.x === "number" ? n.x : 0,
          y: typeof n?.y === "number" ? n.y : 0,
          createdAt: typeof n?.createdAt === "string" ? n.createdAt : now,
          updatedAt: typeof n?.updatedAt === "string" ? n.updatedAt : now,
        }))
      : [],
    edges: Array.isArray(raw.edges)
      ? raw.edges
          .filter((e: any) => e?.sourceId && e?.targetId)
          .map((e: any) => ({
            id: typeof e.id === "string" ? e.id : generateId(),
            sourceId: e.sourceId,
            targetId: e.targetId,
            label: typeof e.label === "string" && e.label ? e.label : "related to",
            createdAt: typeof e.createdAt === "string" ? e.createdAt : now,
          }))
      : [],
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now,
  };
}

async function ensureMigrated(): Promise<void> {
  try {
    const ver = await AsyncStorage.getItem(STORAGE_VERSION_KEY);
    if (ver === String(CURRENT_VERSION)) return;
    const raw = await AsyncStorage.getItem(ATLASES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const migrated = parsed.map((a: unknown) =>
          migrateAtlas(typeof a === "object" && a !== null ? (a as Record<string, unknown>) : {})
        );
        await AsyncStorage.setItem(ATLASES_KEY, JSON.stringify(migrated));
      }
    }
    await AsyncStorage.setItem(STORAGE_VERSION_KEY, String(CURRENT_VERSION));
  } catch (err) {
    console.warn("Migration error:", err);
  }
}

let migrationDone = false;

export async function getAllAtlases(): Promise<Atlas[]> {
  if (!migrationDone) {
    await ensureMigrated();
    migrationDone = true;
  }
  try {
    const raw = await AsyncStorage.getItem(ATLASES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((a: unknown) =>
        migrateAtlas(typeof a === "object" && a !== null ? (a as Record<string, unknown>) : {})
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

export async function getAtlas(id: string): Promise<Atlas | null> {
  return (await getAllAtlases()).find((a) => a.id === id) ?? null;
}

async function writeAll(atlases: Atlas[]): Promise<void> {
  await AsyncStorage.setItem(ATLASES_KEY, JSON.stringify(atlases));
}

export async function saveAtlas(atlas: Atlas): Promise<void> {
  const atlases = await getAllAtlases();
  const idx = atlases.findIndex((a) => a.id === atlas.id);
  if (idx >= 0) atlases[idx] = atlas;
  else atlases.push(atlas);
  await writeAll(atlases);
}

export async function createAtlas(title: string, description: string, color: string): Promise<Atlas> {
  const now = new Date().toISOString();
  const atlas: Atlas = {
    id: generateId(), title, description, color,
    nodes: [], edges: [], createdAt: now, updatedAt: now,
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
  const updated: Atlas = { ...atlas, ...updates, updatedAt: new Date().toISOString() };
  await saveAtlas(updated);
  return updated;
}

export async function deleteAtlas(id: string): Promise<void> {
  const atlases = await getAllAtlases();
  await writeAll(atlases.filter((a) => a.id !== id));
}

export async function addNode(
  atlasId: string,
  node: Omit<AtlasNode, "id" | "createdAt" | "updatedAt">
): Promise<AtlasNode | null> {
  const atlas = await getAtlas(atlasId);
  if (!atlas) return null;
  const now = new Date().toISOString();
  const newNode: AtlasNode = { ...node, id: generateId(), createdAt: now, updatedAt: now };
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
  const idx = atlas.nodes.findIndex((n) => n.id === nodeId);
  if (idx < 0) return null;
  atlas.nodes[idx] = { ...atlas.nodes[idx], ...updates, updatedAt: new Date().toISOString() };
  atlas.updatedAt = new Date().toISOString();
  await saveAtlas(atlas);
  return atlas;
}

export async function deleteNode(atlasId: string, nodeId: string): Promise<Atlas | null> {
  const atlas = await getAtlas(atlasId);
  if (!atlas) return null;
  atlas.nodes = atlas.nodes.filter((n) => n.id !== nodeId);
  atlas.edges = atlas.edges.filter((e) => e.sourceId !== nodeId && e.targetId !== nodeId);
  atlas.updatedAt = new Date().toISOString();
  await saveAtlas(atlas);
  return atlas;
}

export async function addEdge(
  atlasId: string,
  sourceId: string,
  targetId: string,
  label: string
): Promise<AtlasEdge | null> {
  const atlas = await getAtlas(atlasId);
  if (!atlas) return null;
  const now = new Date().toISOString();
  const edge: AtlasEdge = { id: generateId(), sourceId, targetId, label, createdAt: now };
  atlas.edges.push(edge);
  atlas.updatedAt = now;
  await saveAtlas(atlas);
  return edge;
}

export async function deleteEdge(atlasId: string, edgeId: string): Promise<Atlas | null> {
  const atlas = await getAtlas(atlasId);
  if (!atlas) return null;
  atlas.edges = atlas.edges.filter((e) => e.id !== edgeId);
  atlas.updatedAt = new Date().toISOString();
  await saveAtlas(atlas);
  return atlas;
}

interface ImportNode { title: string; type: string; note?: string }
interface ImportEdge { sourceIndex: number; targetIndex: number; label: string }

export async function createAtlasFromImport(data: {
  title: string; description: string; color: string;
  nodes: ImportNode[]; edges: ImportEdge[];
}): Promise<Atlas> {
  const validTypes = new Set(NODE_TYPE_VALUES as readonly string[]);

  const cx = 250, cy = 300;
  const n = data.nodes.length;
  const positions: { x: number; y: number }[] = [];

  if (n <= 1) {
    positions.push({ x: cx, y: cy });
  } else {
    const innerCount = Math.min(n - 1, 7);
    const outerCount = Math.max(0, n - 1 - innerCount);
    positions.push({ x: cx, y: cy });
    for (let i = 0; i < innerCount; i++) {
      const angle = (2 * Math.PI * i) / innerCount - Math.PI / 2;
      positions.push({ x: cx + 160 * Math.cos(angle), y: cy + 160 * Math.sin(angle) });
    }
    for (let i = 0; i < outerCount; i++) {
      const angle = (2 * Math.PI * i) / outerCount - Math.PI / 2;
      positions.push({ x: cx + 290 * Math.cos(angle), y: cy + 290 * Math.sin(angle) });
    }
  }

  const now = new Date().toISOString();
  const atlas: Atlas = {
    id: generateId(),
    title: data.title,
    description: data.description,
    color: data.color,
    nodes: data.nodes.map((nd, i) => ({
      id: generateId(),
      title: nd.title.slice(0, 80),
      type: validTypes.has(nd.type) ? (nd.type as AtlasNode["type"]) : "concept",
      note: nd.note ?? "",
      tags: [],
      x: Math.round((positions[i] ?? { x: cx + Math.random() * 200 - 100 }).x),
      y: Math.round((positions[i] ?? { y: cy + Math.random() * 200 - 100 }).y),
      createdAt: now,
      updatedAt: now,
    })),
    edges: [],
    createdAt: now,
    updatedAt: now,
  };

  for (const e of data.edges) {
    const src = atlas.nodes[e.sourceIndex];
    const tgt = atlas.nodes[e.targetIndex];
    if (!src || !tgt || src.id === tgt.id) continue;
    atlas.edges.push({
      id: generateId(),
      sourceId: src.id,
      targetId: tgt.id,
      label: e.label || "related to",
      createdAt: now,
    });
  }

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
    (a) => a.title.toLowerCase().includes(q) || (a.description?.toLowerCase().includes(q) ?? false)
  );
  const matchingNodes: Array<{ atlasId: string; atlasTitle: string; node: AtlasNode }> = [];
  for (const atlas of atlases) {
    for (const node of atlas.nodes) {
      if (
        node.title.toLowerCase().includes(q) ||
        (node.note?.toLowerCase().includes(q) ?? false) ||
        node.tags.some((t) => t.toLowerCase().includes(q))
      ) {
        matchingNodes.push({ atlasId: atlas.id, atlasTitle: atlas.title, node });
      }
    }
  }
  return { atlases: matchingAtlases, nodes: matchingNodes };
}
