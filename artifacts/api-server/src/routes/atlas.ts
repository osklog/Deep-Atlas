import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 20 } });

// ── Existing: stream AI insights ─────────────────────────────────────────────
router.post("/generate", async (req: Request, res: Response) => {
  const { atlasTitle, nodes, edges, mode } = req.body as {
    atlasTitle: string;
    nodes: Array<{ type: string; title: string; note?: string; tags?: string[] }>;
    edges: Array<{ sourceTitle: string; targetTitle: string; label: string }>;
    mode: "summary" | "explain" | "questions" | "gaps";
  };

  if (!nodes || !Array.isArray(nodes)) {
    res.status(400).json({ error: "nodes array required" });
    return;
  }

  const nodeList = nodes
    .map((n) => `- [${n.type.toUpperCase()}] ${n.title}${n.note ? `: ${n.note}` : ""}${n.tags?.length ? ` (tags: ${n.tags.join(", ")})` : ""}`)
    .join("\n");

  const edgeList = edges && edges.length > 0
    ? edges.map((e) => `- "${e.sourceTitle}" → [${e.label}] → "${e.targetTitle}"`).join("\n")
    : "(no connections yet)";

  const mapContext = `
Atlas: "${atlasTitle}"

Nodes:
${nodeList}

Connections:
${edgeList}
`.trim();

  const prompts: Record<string, string> = {
    summary: `You are an expert knowledge synthesizer. Given this knowledge map, write a concise, insightful summary (3-5 paragraphs) that captures the core themes, key relationships, and overall shape of this intellectual territory. Write as if explaining the landscape to a thoughtful peer.\n\n${mapContext}`,
    explain: `You are an expert at making complex ideas accessible. Given this knowledge map, write a clear explanation of what this topic is about, as if explaining to a curious but uninformed friend. Use plain language, concrete examples where helpful, and highlight the most surprising or important ideas you see in the map.\n\n${mapContext}`,
    questions: `You are a deep thinker and intellectual provocateur. Given this knowledge map, generate 5-8 high-quality next questions or research directions that this map raises but doesn't yet answer. Each question should open a genuine rabbit hole worth exploring. Format as a numbered list with a brief explanation for each question.\n\n${mapContext}`,
    gaps: `You are a critical analyst. Given this knowledge map, identify 4-7 notable contradictions, tensions, unresolved gaps, or blind spots you notice in this map. For each one, explain what seems contradictory or missing and why it matters. Format as a numbered list.\n\n${mapContext}`,
  };

  const prompt = prompts[mode] || prompts.summary;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "Generation failed" })}\n\n`);
    res.end();
  }
});

// ── New: import files → structured atlas ─────────────────────────────────────
const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
const TEXT_TYPES  = new Set(["text/plain", "text/markdown", "text/csv", "text/html",
                              "application/json", "application/xml", "text/xml"]);

const NODE_TYPES = ["concept", "person", "company", "source", "question", "event", "hypothesis", "quote", "media"] as const;
const EDGE_LABELS = ["related to", "supports", "contradicts", "influenced by", "caused by",
                     "part of", "leads to", "raises", "cites", "example of", "challenges"] as const;

router.post("/import", upload.array("files", 20), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined;
  const customTitle: string = (req.body.title ?? "").trim();

  if (!files || files.length === 0) {
    res.status(400).json({ error: "No files uploaded" });
    return;
  }

  // Build the multimodal message content
  const contentParts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "high" } }> = [];

  const skipped: string[] = [];

  for (const file of files) {
    const mime = file.mimetype.toLowerCase();
    const name = file.originalname;

    if (IMAGE_TYPES.has(mime)) {
      const b64 = file.buffer.toString("base64");
      contentParts.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${b64}`, detail: "high" },
      });
      contentParts.push({ type: "text", text: `[File: ${name}]` });
    } else if (TEXT_TYPES.has(mime) || mime === "application/pdf") {
      try {
        const text = file.buffer.toString("utf-8");
        contentParts.push({
          type: "text",
          text: `[File: ${name}]\n${text.slice(0, 8000)}`, // cap per-file
        });
      } catch {
        skipped.push(name);
      }
    } else {
      // Try reading as text anyway
      try {
        const text = file.buffer.toString("utf-8");
        if (text && text.length > 10) {
          contentParts.push({ type: "text", text: `[File: ${name}]\n${text.slice(0, 4000)}` });
        } else {
          skipped.push(name);
        }
      } catch {
        skipped.push(name);
      }
    }
  }

  if (contentParts.length === 0) {
    res.status(400).json({ error: "No readable content found in uploaded files" });
    return;
  }

  const systemPrompt = `You are a knowledge graph extractor. The user has provided one or more files (documents, images, notes, etc.). Your task is to analyze ALL the content and produce a structured knowledge graph atlas.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "title": "concise atlas title based on content",
  "description": "1-2 sentence description of what this atlas covers",
  "color": "#hex",
  "nodes": [
    {
      "title": "short node title",
      "type": "${NODE_TYPES.join("|")}",
      "note": "1-2 sentence explanation or key insight about this node"
    }
  ],
  "edges": [
    {
      "sourceIndex": 0,
      "targetIndex": 1,
      "label": "${EDGE_LABELS.join("|")}"
    }
  ]
}

Rules:
- Create 8-25 nodes that capture the most important concepts, people, events, ideas, and relationships in the content
- Every node MUST have the correct type: concept (ideas/topics), person (named individuals), company (organizations), source (books/papers/articles), question (open problems), event (things that happened), hypothesis (theories/speculation), quote (direct quotes), media (images/videos/files)
- Create meaningful edges that express real relationships — aim for 1-2 edges per node on average
- sourceIndex and targetIndex are 0-based indices into the nodes array
- Choose color as a rich hex color that fits the topic (e.g., blue for tech, green for biology, gold for history)
- If a custom title is provided, use it: "${customTitle || "(derive from content)"}"`;

  contentParts.unshift({ type: "text", text: systemPrompt });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: contentParts as any }],
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON", raw });
      return;
    }

    res.json({ ...parsed, skipped });
  } catch (err: any) {
    console.error("Import error:", err?.message ?? err);
    res.status(500).json({ error: err?.message ?? "Import failed" });
  }
});

export default router;
