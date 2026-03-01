/**
 * Vercel serverless function: Index pasted text.
 * Returns serialized IndexData for client-side storage.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { TreeDex, OpenAICompatibleLLM, textToPages } from "treedex";

function makeLLM() {
  return new OpenAICompatibleLLM({
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1",
    model: process.env.LLM_MODEL ?? "llama-3.3-70b-versatile",
    apiKey: process.env.GROQ_API_KEY ?? "",
    maxTokens: 4096,
    temperature: 0.0,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.GROQ_API_KEY) {
    res.status(500).json({ error: "GROQ_API_KEY not configured" });
    return;
  }

  const llm = makeLLM();

  try {
    const { text, title } = req.body as { text?: string; title?: string };
    if (!text || text.trim().length === 0) {
      res.status(400).json({ error: "No text provided" });
      return;
    }

    const fileName = title || "Pasted Text";
    const pages = textToPages(text, 3000);
    const index = await TreeDex.fromPages(pages, llm, { verbose: true });

    const stats = index.stats();
    const id = `v-${Date.now()}`;
    const indexData = { version: "1.0", framework: "TreeDex", tree: index.tree, pages: index.pages };

    res.json({
      success: true,
      documents: [{ id, fileName, stats, indexData }],
    });
  } catch (err) {
    console.error("Index error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
