import { z } from "zod";

export const NODE_TYPE_VALUES = [
  "concept", "person", "company", "source", "question",
  "event", "hypothesis", "quote", "media",
] as const;

export type NodeType = (typeof NODE_TYPE_VALUES)[number];

export const NodeTypeSchema = z.enum(NODE_TYPE_VALUES);

export const SUGGESTED_LABELS = [
  "supports", "contradicts", "influenced by", "raises", "belongs to",
  "leads to", "related to", "challenges", "defines", "enables",
  "depends on", "emerged from", "preceded", "caused by", "part of",
  "cites", "example of", "undermines", "inspired by", "predicts",
  "is a special case of", "operationalises", "measures",
];

export const AtlasNodeSchema = z.object({
  id: z.string(),
  type: NodeTypeSchema.catch("concept"),
  title: z.string().min(1),
  note: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  imageUri: z.string().optional(),
  x: z.number().catch(0),
  y: z.number().catch(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AtlasNode = z.infer<typeof AtlasNodeSchema>;

export const AtlasEdgeSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  label: z.string().min(1).catch("related to"),
  createdAt: z.string(),
});

export type AtlasEdge = z.infer<typeof AtlasEdgeSchema>;

export const AtlasSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().optional().default(""),
  color: z.string().default("#C9A96E"),
  nodes: z.array(AtlasNodeSchema).default([]),
  edges: z.array(AtlasEdgeSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Atlas = z.infer<typeof AtlasSchema>;

export const ImportNodeSchema = z.object({
  title: z.string().min(1),
  type: z.string().default("concept"),
  note: z.string().optional().default(""),
});

export const ImportEdgeSchema = z.object({
  sourceIndex: z.number().int().min(0),
  targetIndex: z.number().int().min(0),
  label: z.string().default("related to"),
});

export const ImportResponseSchema = z.object({
  title: z.string().default("Imported Atlas"),
  description: z.string().default(""),
  color: z.string().default("#6E9CF0"),
  nodes: z.array(ImportNodeSchema).min(1),
  edges: z.array(ImportEdgeSchema).default([]),
  skipped: z.array(z.string()).optional().default([]),
});

export type RelationshipLabel = string;

export const RELATIONSHIP_LABELS = SUGGESTED_LABELS;

export const NODE_TYPES: NodeType[] = [...NODE_TYPE_VALUES];

export const NODE_ICONS: Record<NodeType, string> = {
  concept: "cpu",
  person: "user",
  company: "briefcase",
  source: "book-open",
  question: "help-circle",
  event: "calendar",
  hypothesis: "zap",
  quote: "message-square",
  media: "image",
};

export const NODE_LABELS: Record<NodeType, string> = {
  concept: "Concept",
  person: "Person",
  company: "Company",
  source: "Source",
  question: "Question",
  event: "Event",
  hypothesis: "Hypothesis",
  quote: "Quote",
  media: "Media",
};

export const ATLAS_COLORS = [
  "#C9A96E", "#6E9CF0", "#4ECDC4", "#C46EF0",
  "#F06E6E", "#6EF08A", "#F0E96E", "#F06EB8",
];
