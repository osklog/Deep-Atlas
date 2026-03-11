export type NodeType =
  | "concept"
  | "person"
  | "company"
  | "source"
  | "question"
  | "event"
  | "hypothesis"
  | "quote"
  | "media";

export type RelationshipLabel =
  | "supports"
  | "contradicts"
  | "influenced by"
  | "raises"
  | "belongs to"
  | "leads to"
  | "related to"
  | "challenges"
  | "defines";

export interface AtlasNode {
  id: string;
  type: NodeType;
  title: string;
  note?: string;
  tags: string[];
  imageUri?: string;
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
}

export interface AtlasEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: RelationshipLabel;
  createdAt: string;
}

export interface Atlas {
  id: string;
  title: string;
  description?: string;
  color: string;
  nodes: AtlasNode[];
  edges: AtlasEdge[];
  createdAt: string;
  updatedAt: string;
}

export const NODE_TYPES: NodeType[] = [
  "concept",
  "person",
  "company",
  "source",
  "question",
  "event",
  "hypothesis",
  "quote",
  "media",
];

export const RELATIONSHIP_LABELS: RelationshipLabel[] = [
  "supports",
  "contradicts",
  "influenced by",
  "raises",
  "belongs to",
  "leads to",
  "related to",
  "challenges",
  "defines",
];

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
  "#C9A96E",
  "#6E9CF0",
  "#4ECDC4",
  "#C46EF0",
  "#F06E6E",
  "#6EF08A",
  "#F0E96E",
  "#F06EB8",
];
