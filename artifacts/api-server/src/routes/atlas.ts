import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

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

export default router;
