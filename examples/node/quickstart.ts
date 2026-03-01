/**
 * TreeDex Quick Start Example (Node.js)
 *
 * Usage:
 *   npx tsx examples/node/quickstart.ts path/to/document.pdf
 *
 * Requirements:
 *   npm install treedex @google/generative-ai
 *   export GEMINI_API_KEY="your-key"
 */

import { TreeDex, GeminiLLM } from "../../src/index.js";
import { createInterface } from "node:readline";

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.log("Usage: npx tsx examples/node/quickstart.ts <path-to-pdf>");
    process.exit(1);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("Set GEMINI_API_KEY environment variable");
    process.exit(1);
  }

  // 1. Create LLM backend
  const llm = new GeminiLLM(apiKey);

  // 2. Build index
  console.log(`Indexing: ${pdfPath}`);
  const index = await TreeDex.fromFile(pdfPath, llm);

  // 3. Show structure
  console.log("\n--- Document Structure ---");
  index.showTree();

  // 4. Show stats
  console.log("\n--- Stats ---");
  const stats = index.stats();
  for (const [k, v] of Object.entries(stats)) {
    console.log(`  ${k}: ${v}`);
  }

  // 5. Interactive query loop
  console.log("\n--- Query Mode (type 'quit' to exit) ---");
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const ask = (): void => {
    rl.question("\nQuestion: ", async (question) => {
      const q = question.trim();
      if (["quit", "exit", "q"].includes(q.toLowerCase())) {
        rl.close();
        return;
      }

      const result = await index.query(q);
      console.log(`\nSource: ${result.pagesStr}`);
      console.log(`Reasoning: ${result.reasoning}`);
      console.log(`\nContext:\n${result.context.slice(0, 1000)}`);
      ask();
    });
  };

  ask();
}

main().catch(console.error);
