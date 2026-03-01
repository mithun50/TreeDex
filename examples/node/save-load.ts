/**
 * Example: Save and load TreeDex indexes (Node.js)
 *
 * Build once, query forever — save the index to JSON and
 * reload it without re-processing the document.
 *
 * Usage:
 *   npx tsx examples/node/save-load.ts path/to/document.pdf
 */

import { TreeDex, GeminiLLM } from "../../src/index.js";
import { existsSync } from "node:fs";

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("Set GEMINI_API_KEY environment variable");
    process.exit(1);
  }

  const llm = new GeminiLLM(apiKey);
  const indexPath = "saved_index.json";

  let index: InstanceType<typeof TreeDex>;

  // Build or load
  if (existsSync(indexPath)) {
    console.log(`Loading existing index from ${indexPath}...`);
    index = await TreeDex.load(indexPath, llm);
  } else {
    const pdfPath = process.argv[2];
    if (!pdfPath) {
      console.log("Usage: npx tsx examples/node/save-load.ts <path-to-pdf>");
      console.log("       (On first run, pass a PDF to build the index)");
      process.exit(1);
    }

    console.log(`Building index from ${pdfPath}...`);
    index = await TreeDex.fromFile(pdfPath, llm);
    await index.save(indexPath);
    console.log(`Saved to ${indexPath}`);
  }

  // Show stats
  const stats = index.stats();
  console.log(
    `\nIndex: ${stats.total_nodes} nodes, ` +
      `${stats.total_pages} pages, ` +
      `${stats.total_tokens.toLocaleString()} tokens`,
  );

  // Query
  const result = await index.query("What are the key topics?");
  console.log(`\nQuery result: ${result.pagesStr}`);
  console.log(`Context preview: ${result.context.slice(0, 300)}...`);
}

main().catch(console.error);
