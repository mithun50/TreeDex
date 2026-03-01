/**
 * Example: Using multiple LLM providers with TreeDex (Node.js)
 *
 * Demonstrates how to build an index with one provider
 * and query it with another.
 */

import {
  TreeDex,
  GeminiLLM,
  GroqLLM,
  OpenAICompatibleLLM,
} from "../../src/index.js";

async function main() {
  // --- Provider 1: Build index with Gemini ---
  const gemini = new GeminiLLM(process.env.GEMINI_API_KEY!);

  console.log("Building index with Gemini...");
  const index = await TreeDex.fromFile("document.pdf", gemini);
  await index.save("my_index.json");

  // --- Provider 2: Query with Groq (fast inference) ---
  const groq = new GroqLLM(
    process.env.GROQ_API_KEY!,
    "llama-3.3-70b-versatile",
  );

  console.log("\nQuerying with Groq...");
  const result = await index.query("What are the main findings?", groq);
  console.log(`  Nodes: ${JSON.stringify(result.nodeIds)}`);
  console.log(`  Pages: ${result.pagesStr}`);

  // --- Provider 3: Query with any OpenAI-compatible endpoint ---
  const custom = new OpenAICompatibleLLM({
    baseUrl: "https://api.together.xyz/v1",
    apiKey: process.env.TOGETHER_API_KEY ?? "",
    model: "meta-llama/Llama-3-70b-chat-hf",
  });

  console.log("\nQuerying with Together AI...");
  const result2 = await index.query("Summarize the methodology.", custom);
  console.log(`  Nodes: ${JSON.stringify(result2.nodeIds)}`);
  console.log(`  Pages: ${result2.pagesStr}`);
}

main().catch(console.error);
