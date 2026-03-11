import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Atlas, NODE_LABELS, NODE_TYPE_VALUES, NodeType } from "@/types/atlas";

export function atlasToJSON(atlas: Atlas): string {
  return JSON.stringify(atlas, null, 2);
}

export function atlasToMarkdown(atlas: Atlas): string {
  const lines: string[] = [];

  lines.push(`# ${atlas.title}`);
  if (atlas.description) {
    lines.push("", atlas.description);
  }
  lines.push("", `**${atlas.nodes.length} nodes** | **${atlas.edges.length} connections**`);
  lines.push(`*Last updated: ${new Date(atlas.updatedAt).toLocaleDateString()}*`);

  const byType = new Map<NodeType, typeof atlas.nodes>();
  for (const node of atlas.nodes) {
    const list = byType.get(node.type) ?? [];
    list.push(node);
    byType.set(node.type, list);
  }

  for (const t of NODE_TYPE_VALUES) {
    const group = byType.get(t);
    if (!group || group.length === 0) continue;
    lines.push("", `## ${NODE_LABELS[t]} (${group.length})`);
    for (const node of group) {
      lines.push("", `### ${node.title}`);
      if (node.note) lines.push(node.note);
      if (node.tags && node.tags.length > 0) {
        lines.push(`*Tags: ${node.tags.map((t) => `#${t}`).join(" ")}*`);
      }
    }
  }

  if (atlas.edges.length > 0) {
    lines.push("", "## Connections");
    for (const edge of atlas.edges) {
      const src = atlas.nodes.find((n) => n.id === edge.sourceId);
      const tgt = atlas.nodes.find((n) => n.id === edge.targetId);
      if (src && tgt) {
        lines.push(`- **${src.title}** → *${edge.label}* → **${tgt.title}**`);
      }
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_").slice(0, 60) || "atlas";
}

export async function shareAtlas(atlas: Atlas, format: "json" | "markdown"): Promise<boolean> {
  const available = await Sharing.isAvailableAsync();
  if (!available) return false;

  const baseName = sanitizeFilename(atlas.title);
  const ext = format === "json" ? "json" : "md";
  const content = format === "json" ? atlasToJSON(atlas) : atlasToMarkdown(atlas);
  const fileName = `${baseName}.${ext}`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, content, { encoding: "utf8" });
  await Sharing.shareAsync(fileUri, {
    mimeType: format === "json" ? "application/json" : "text/markdown",
    dialogTitle: `Export: ${atlas.title}`,
    UTI: format === "json" ? "public.json" : "net.daringfireball.markdown",
  });
  return true;
}
