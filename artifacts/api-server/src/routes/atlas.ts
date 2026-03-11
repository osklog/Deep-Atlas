import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

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
// Body: { title?: string, files: Array<{ name: string, mimeType: string, content: string, isBase64: boolean }> }

interface ImportFile {
  name: string;
  mimeType: string;
  content: string; // raw text OR base64 string
  isBase64: boolean;
}

const IMAGE_MIMES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);

router.post("/import", async (req: Request, res: Response) => {
  const { title: customTitle = "", files } = req.body as { title?: string; files: ImportFile[] };

  if (!Array.isArray(files) || files.length === 0) {
    res.status(400).json({ error: "No files provided" });
    return;
  }

  // Build multimodal message content for OpenAI
  type TextPart = { type: "text"; text: string };
  type ImagePart = { type: "image_url"; image_url: { url: string; detail: "high" } };
  const contentParts: Array<TextPart | ImagePart> = [];
  const skipped: string[] = [];

  for (const file of files) {
    const mime = (file.mimeType ?? "").toLowerCase();
    const name = file.name ?? "unknown";

    if (file.isBase64 && IMAGE_MIMES.has(mime)) {
      contentParts.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${file.content}`, detail: "high" },
      });
      contentParts.push({ type: "text", text: `[Image file: ${name}]` });
    } else if (!file.isBase64 && file.content) {
      contentParts.push({
        type: "text",
        text: `[File: ${name}]\n${file.content.slice(0, 8000)}`,
      });
    } else {
      skipped.push(name);
    }
  }

  if (contentParts.length === 0) {
    res.status(400).json({ error: "No readable content found in uploaded files" });
    return;
  }

  const systemPrompt = `You are a knowledge graph extractor. The user has provided one or more files (documents, images, notes, etc.). Analyze ALL the content and produce a structured knowledge graph atlas.

Return ONLY valid JSON — no markdown fences, no explanation, just the JSON object:
{
  "title": "concise atlas title",
  "description": "1-2 sentence description",
  "color": "#hexcolor",
  "nodes": [
    { "title": "short title", "type": "concept|person|company|source|question|event|hypothesis|quote|media", "note": "1-2 sentence insight" }
  ],
  "edges": [
    { "sourceIndex": 0, "targetIndex": 1, "label": "related to|supports|contradicts|influenced by|caused by|part of|leads to|raises|cites|example of|challenges|defines|belongs to" }
  ]
}

Rules:
- Create 8-25 nodes capturing the most important concepts, people, events, ideas
- Every node has the correct type: concept (ideas/topics), person (individuals), company (orgs), source (books/papers), question (open problems), event (happenings), hypothesis (theories), quote (verbatim quotes), media (images/files)
- Create meaningful edges expressing real relationships (aim for 1-2 per node on average)
- sourceIndex and targetIndex are 0-based indices into the nodes array
- color: a rich hex color fitting the topic (blue=tech, green=biology, gold=history, purple=philosophy)
${customTitle ? `- Atlas title must be: "${customTitle}"` : "- Derive a good title from the content"}`;

  contentParts.unshift({ type: "text", text: systemPrompt });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: contentParts as any }],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";

    let parsed: any = {};
    // Strip markdown fences if present, then parse
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    try {
      parsed = JSON.parse(stripped);
    } catch {
      const match = stripped.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { /* leave as {} */ }
      }
    }

    res.json({ ...parsed, skipped });
  } catch (err: any) {
    console.error("Import error:", err?.message ?? err);
    res.status(500).json({ error: err?.message ?? "Import failed" });
  }
});

export default router;
