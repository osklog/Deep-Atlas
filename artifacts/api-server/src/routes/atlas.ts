import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

function safeWriteSSE(res: Response, data: string): boolean {
  if (res.writableEnded) return false;
  try { res.write(data); return true; } catch { return false; }
}

function setupSSE(req: Request, res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.on("error", () => {});

  let gone = false;
  req.on("close", () => { gone = true; });

  return {
    write: (obj: Record<string, unknown>) => {
      if (gone) return false;
      return safeWriteSSE(res, `data: ${JSON.stringify(obj)}\n\n`);
    },
    end: () => { if (!res.writableEnded) res.end(); },
    get closed() { return gone; },
  };
}

import { stripCodeFences, extractJSON } from "../lib/json-extract.js";

async function extractPdfText(base64Content: string): Promise<string> {
  try {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
    const buffer = Buffer.from(base64Content, "base64");
    const result = await pdfParse(buffer);
    return result.text?.trim() ?? "";
  } catch (err: any) {
    console.error("PDF extraction failed:", err?.message ?? err);
    return "";
  }
}

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

  const mapContext = `Atlas: "${atlasTitle}"\n\nNodes:\n${nodeList}\n\nConnections:\n${edgeList}`;

  const prompts: Record<string, string> = {
    summary: `You are an expert knowledge synthesizer. Given this knowledge map, write a concise, insightful summary (3-5 paragraphs) that captures the core themes, key relationships, and overall shape of this intellectual territory. Write as if explaining the landscape to a thoughtful peer.\n\n${mapContext}`,
    explain: `You are an expert at making complex ideas accessible. Given this knowledge map, write a clear explanation of what this topic is about, as if explaining to a curious but uninformed friend. Use plain language, concrete examples where helpful, and highlight the most surprising or important ideas you see in the map.\n\n${mapContext}`,
    questions: `You are a deep thinker and intellectual provocateur. Given this knowledge map, generate 5-8 high-quality next questions or research directions that this map raises but doesn't yet answer. Each question should open a genuine rabbit hole worth exploring. Format as a numbered list with a brief explanation for each question.\n\n${mapContext}`,
    gaps: `You are a critical analyst. Given this knowledge map, identify 4-7 notable contradictions, tensions, unresolved gaps, or blind spots you notice in this map. For each one, explain what seems contradictory or missing and why it matters. Format as a numbered list.\n\n${mapContext}`,
  };

  const prompt = prompts[mode] || prompts.summary;
  const sse = setupSSE(req, res);

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    for await (const chunk of stream) {
      if (sse.closed) { stream.controller.abort(); break; }
      const content = chunk.choices[0]?.delta?.content;
      if (content) sse.write({ content });
    }

    sse.write({ done: true });
    sse.end();
  } catch (err) {
    sse.write({ error: "Generation failed" });
    sse.end();
  }
});

interface ImportFile {
  name: string;
  mimeType: string;
  content: string;
  isBase64: boolean;
}

const IMAGE_MIMES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
const PDF_MIMES = new Set(["application/pdf"]);

router.post("/import", async (req: Request, res: Response) => {
  const { title: customTitle = "", files } = req.body as { title?: string; files: ImportFile[] };

  if (!Array.isArray(files) || files.length === 0) {
    res.status(400).json({ error: "No files provided" });
    return;
  }

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
    } else if (file.isBase64 && PDF_MIMES.has(mime)) {
      const text = await extractPdfText(file.content);
      if (text.length > 20) {
        contentParts.push({
          type: "text",
          text: `[PDF: ${name}]\n${text.slice(0, 12000)}`,
        });
      } else {
        skipped.push(`${name} (could not extract text)`);
      }
    } else if (!file.isBase64 && file.content) {
      const cleaned = file.content.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
      if (cleaned.length > 10) {
        contentParts.push({
          type: "text",
          text: `[File: ${name}]\n${cleaned.slice(0, 12000)}`,
        });
      } else {
        skipped.push(`${name} (too short)`);
      }
    } else {
      skipped.push(name);
    }
  }

  if (contentParts.length === 0) {
    res.status(400).json({ error: "No readable content found in uploaded files" });
    return;
  }

  const systemPrompt = `You are an expert knowledge cartographer. The user has provided files — analyze them deeply and produce a rich, insightful knowledge graph atlas that captures the TRUE intellectual structure of the content, not just a surface-level list.

Return ONLY valid JSON — no markdown fences, no preamble, just the raw JSON object:
{
  "title": "sharp, evocative atlas title (5 words max)",
  "description": "2-3 sentences describing what intellectual territory this atlas maps and why it matters",
  "color": "#hexcolor",
  "nodes": [
    { "title": "concise node title", "type": "concept|person|company|source|question|event|hypothesis|quote|media", "note": "2-3 sentences: what is this, why does it matter, what makes it non-obvious or interesting?" }
  ],
  "edges": [
    { "sourceIndex": 0, "targetIndex": 1, "label": "relationship label" }
  ]
}

NODE RULES — be generous, aim for 15-25 nodes:
- concept: abstract ideas, mechanisms, frameworks, principles
- person: named individuals (researchers, founders, historical figures)
- company: organisations, institutions, projects
- source: books, papers, articles, datasets cited or referenced
- question: open problems, unresolved tensions, things left unexplained
- event: specific happenings with a date or moment in time
- hypothesis: proposed explanations, theories, contested claims
- quote: a verbatim or near-verbatim statement from the content
- media: images, diagrams, charts described in the content

NODE QUALITY — every note must contain REAL insight:
- Do NOT write "X is a concept related to Y" — that is useless
- DO write what makes this node surprising, contested, or important
- Include concrete details: numbers, names, mechanisms, consequences
- For images: describe what is visually depicted and its significance
- Do NOT create duplicate or near-duplicate nodes

EDGE RULES — aim for 1.5-2 edges per node:
- Use precise relationship labels, not vague "related to"
- Good labels: "enables", "contradicts", "preceded", "operationalises", "is a special case of", "undermines", "was inspired by", "measures", "predicts", "emerged from", "depends on", "challenges"
- Capture non-obvious connections: who influenced whom, what causes what, what contradicts what

QUALITY STANDARDS:
- A great atlas reveals the hidden skeleton of ideas — show tensions, dependencies, and surprising links
- Avoid generic placeholder nodes ("Introduction", "Overview", "Main Topic")
- Every node must earn its place — if you can't write an insightful note, merge it with another
- sourceIndex and targetIndex are 0-based indices into the nodes array
- color: choose a rich thematic hex (e.g. #1E5AA8 for tech/systems, #2D7A4F for biology, #8B5E3C for history, #5B2D8E for philosophy, #A83232 for conflict/politics)
${customTitle ? `- The atlas title MUST be: "${customTitle}"` : "- Derive a sharp, evocative title that names the intellectual territory, not just the topic"}`;

  contentParts.unshift({ type: "text", text: systemPrompt });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      messages: [{ role: "user", content: contentParts as any }],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = extractJSON(raw);

    if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
      res.status(422).json({
        error: "AI returned invalid or empty atlas. Try with different content.",
        raw: raw.slice(0, 500),
      });
      return;
    }

    res.json({ ...parsed, skipped });
  } catch (err: any) {
    console.error("Import error:", err?.message ?? err);
    res.status(500).json({ error: err?.message ?? "Import failed" });
  }
});

export default router;
