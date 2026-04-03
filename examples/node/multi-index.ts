/**
 * Example: Query multiple TreeDex indexes simultaneously (Node.js)
 *
 * Demonstrates building separate indexes for multiple documents and querying
 * them all at once with TreeDex.queryAll().
 */

import { TreeDex, GeminiLLM } from "../../src/index.js";

async function main() {
  const llm = new GeminiLLM(process.env.GEMINI_API_KEY!);

  // --- Build indexes for multiple documents ---
  console.log("Building indexes...");
  const indexA = await TreeDex.fromFile("manual_a.pdf", llm);
  const indexB = await TreeDex.fromFile("manual_b.pdf", llm);
  const indexC = await TreeDex.fromFile("manual_c.pdf", llm);

  // Optionally save and reload later
  await indexA.save("manual_a.json");
  await indexB.save("manual_b.json");
  await indexC.save("manual_c.json");

  // --- Query all indexes at once ---
  const question = "What are the safety guidelines?";

  console.log(`\nQuerying all indexes: '${question}'`);
  const multi = await TreeDex.queryAll(
    [indexA, indexB, indexC],
    question,
    { labels: ["Manual A", "Manual B", "Manual C"] },
  );

  // Inspect per-index results
  multi.results.forEach((result, i) => {
    console.log(`\n[${multi.labels[i]}]`);
    console.log(`  Nodes:  ${JSON.stringify(result.nodeIds)}`);
    console.log(`  Pages:  ${result.pagesStr}`);
    console.log(`  Reason: ${result.reasoning}`);
  });

  // Combined context with [Manual A] / [Manual B] / [Manual C] headers
  console.log("\n--- Combined Context ---");
  console.log(multi.combinedContext.slice(0, 500), "...");

  // --- Agentic mode: one answer across all documents ---
  console.log("\nQuerying with agentic answer...");
  const multiAgentic = await TreeDex.queryAll(
    [indexA, indexB, indexC],
    question,
    { labels: ["Manual A", "Manual B", "Manual C"], agentic: true },
  );
  console.log(`\nAnswer:\n${multiAgentic.answer}`);
}

main().catch(console.error);
