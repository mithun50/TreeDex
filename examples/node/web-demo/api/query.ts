/**
 * Vercel serverless function: Query documents.
 * Accepts client-provided indexes (from IndexedDB), reconstructs TreeDex, and queries.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { TreeDex, OpenAICompatibleLLM, answerPrompt } from "treedex";

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
    const { question, indexes, docId } = req.body as {
      question?: string;
      indexes?: Array<{ id: string; fileName: string; data: { tree: unknown[]; pages: unknown[] } }>;
      docId?: string;
    };

    if (!question || question.trim().length === 0) {
      res.status(400).json({ error: "No question provided" });
      return;
    }

    if (!indexes || indexes.length === 0) {
      res.status(400).json({ error: "No documents indexed yet. Upload a file first." });
      return;
    }

    // Reconstruct indexes from client data
    const docs = indexes
      .filter(idx => !docId || idx.id === docId)
      .map(idx => ({
        id: idx.id,
        fileName: idx.fileName,
        index: TreeDex.fromTree(idx.data.tree as any, idx.data.pages as any, llm),
      }));

    if (docs.length === 0) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    // Query all matching docs
    const allResults: Array<{
      docId: string;
      fileName: string;
      answer: string;
      context: string;
      nodeIds: string[];
      pagesStr: string;
      reasoning: string;
    }> = [];

    for (const doc of docs) {
      const result = await doc.index.query(question, { agentic: true });
      if (result.nodeIds.length > 0) {
        allResults.push({
          docId: doc.id,
          fileName: doc.fileName,
          answer: result.answer,
          context: result.context,
          nodeIds: result.nodeIds,
          pagesStr: result.pagesStr,
          reasoning: result.reasoning,
        });
      }
    }

    if (allResults.length === 0) {
      const docNames = indexes.map(idx => idx.fileName).join(", ");
      const fallbackPrompt = `You are a helpful document assistant. The user has uploaded these documents: ${docNames}.
The user said: "${question}"

If this is a greeting or casual message, respond warmly and briefly, mentioning you're ready to answer questions about their documents.
If this is a real question but no relevant info was found in the documents, say so politely and suggest they rephrase or check if the right documents are uploaded.
Keep your response concise (1-3 sentences).`;
      const fallbackAnswer = await llm.generate(fallbackPrompt);
      res.json({ answer: fallbackAnswer, context: "", nodeIds: [], pagesStr: "", reasoning: "No matching document sections found — responded conversationally.", results: [] });
    } else if (allResults.length === 1) {
      const r = allResults[0];
      res.json({
        answer: r.answer,
        context: r.context,
        nodeIds: r.nodeIds,
        pagesStr: r.pagesStr,
        reasoning: r.reasoning,
        source: r.fileName,
        results: allResults,
      });
    } else {
      // Multiple docs — combine and generate unified answer
      const combinedContext = allResults
        .map(r => `[From: ${r.fileName}]\n${r.context}`)
        .join("\n\n---\n\n");

      const unifiedAnswer = await llm.generate(answerPrompt(combinedContext, question));
      const sources = allResults.map(r => `${r.fileName} (${r.pagesStr})`).join(", ");

      res.json({
        answer: unifiedAnswer,
        context: combinedContext,
        nodeIds: allResults.flatMap(r => r.nodeIds),
        pagesStr: sources,
        reasoning: allResults.map(r => `[${r.fileName}] ${r.reasoning}`).join(" | "),
        results: allResults,
      });
    }
  } catch (err) {
    console.error("Query error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
