import { describe, it, expect, vi } from "vitest";
import { writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TreeDex, QueryResult, MultiQueryResult } from "../src/core.js";
import { FunctionLLM } from "../src/llm-backends.js";
import {
  listToTree,
  assignPageRanges,
  assignNodeIds,
  embedTextInTree,
} from "../src/tree-builder.js";
import type { Page, TreeNode } from "../src/types.js";

const TMP_DIR = join(tmpdir(), "treedex-core-test-" + Date.now());

function makeMockLlm(): FunctionLLM {
  return new FunctionLLM((prompt: string) => {
    if (
      prompt.includes("structure analyzer") ||
      prompt.includes("continuing to extract")
    ) {
      return JSON.stringify([
        { structure: "1", title: "Introduction", physical_index: 0 },
        { structure: "1.1", title: "Background", physical_index: 0 },
        { structure: "2", title: "Methods", physical_index: 1 },
      ]);
    } else if (prompt.includes("retrieval system")) {
      return JSON.stringify({
        node_ids: ["0001", "0003"],
        reasoning: "These sections are most relevant.",
      });
    }
    return "{}";
  });
}

function makePages(n: number = 5): Page[] {
  return Array.from({ length: n }, (_, i) => ({
    page_num: i,
    text: `Content of page ${i}.`,
    token_count: 50,
  }));
}

function makeTreeAndPages(): { tree: TreeNode[]; pages: Page[] } {
  const data = [
    { structure: "1", title: "Intro", physical_index: 0 },
    { structure: "1.1", title: "Background", physical_index: 0 },
    { structure: "2", title: "Methods", physical_index: 2 },
  ];
  const pages = makePages(5);
  const tree = listToTree(data);
  assignPageRanges(tree, 5);
  assignNodeIds(tree);
  embedTextInTree(tree, pages);
  return { tree, pages };
}

describe("QueryResult", () => {
  it("should format single page", () => {
    const qr = new QueryResult("ctx", ["0001"], [[0, 0]], "reason");
    expect(qr.pagesStr).toBe("pages 1");
  });

  it("should format page range", () => {
    const qr = new QueryResult("ctx", ["0001"], [[4, 7]], "reason");
    expect(qr.pagesStr).toBe("pages 5-8");
  });

  it("should format multiple ranges", () => {
    const qr = new QueryResult(
      "ctx",
      ["0001", "0002"],
      [
        [0, 2],
        [5, 5],
      ],
      "reason",
    );
    expect(qr.pagesStr).toBe("pages 1-3, 6");
  });

  it("should handle empty ranges", () => {
    const qr = new QueryResult("ctx", [], [], "reason");
    expect(qr.pagesStr).toBe("no pages");
  });

  it("should have toString", () => {
    const qr = new QueryResult("context text", ["0001"], [[0, 2]], "reason");
    const r = qr.toString();
    expect(r).toContain("0001");
    expect(r).toContain("context_len=");
  });
});

describe("TreeDex.fromTree", () => {
  it("should construct from tree and pages", () => {
    const { tree, pages } = makeTreeAndPages();
    const index = TreeDex.fromTree(tree, pages);
    expect(index.tree).toBe(tree);
    expect(index.pages).toBe(pages);
  });

  it("should compute stats", () => {
    const { tree, pages } = makeTreeAndPages();
    const index = TreeDex.fromTree(tree, pages);
    const stats = index.stats();
    expect(stats.total_pages).toBe(5);
    expect(stats.total_nodes).toBe(3);
    expect(stats.root_sections).toBe(2);
  });

  it("should show tree", () => {
    const { tree, pages } = makeTreeAndPages();
    const index = TreeDex.fromTree(tree, pages);
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    index.showTree();
    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Intro");
    expect(output).toContain("Methods");
    spy.mockRestore();
  });
});

describe("TreeDex.fromPages", () => {
  it("should build from pages", async () => {
    const llm = makeMockLlm();
    const pages = makePages(5);
    const index = await TreeDex.fromPages(pages, llm, { verbose: false });
    expect(index.stats().total_nodes).toBe(3);
  });

  it("should build from txt file", async () => {
    await mkdir(TMP_DIR, { recursive: true });
    const filePath = join(TMP_DIR, "test.txt");
    await writeFile(filePath, "Hello world. ".repeat(100));

    const llm = makeMockLlm();
    const index = await TreeDex.fromFile(filePath, llm, { verbose: false });
    expect(index.stats().total_pages).toBeGreaterThanOrEqual(1);

    await rm(TMP_DIR, { recursive: true, force: true });
  });
});

describe("TreeDex.query", () => {
  it("should query and return results", async () => {
    const { tree, pages } = makeTreeAndPages();
    const llm = makeMockLlm();
    const index = TreeDex.fromTree(tree, pages, llm);
    const result = await index.query("What methods were used?");

    expect(result.nodeIds).toContain("0001");
    expect(result.nodeIds).toContain("0003");
    expect(result.context.length).toBeGreaterThan(0);
    expect(result.reasoning).toContain("relevant");
  });

  it("should accept override LLM", async () => {
    const { tree, pages } = makeTreeAndPages();
    const index = TreeDex.fromTree(tree, pages);

    const llm = makeMockLlm();
    const result = await index.query("question", llm);
    expect(result.nodeIds.length).toBeGreaterThan(0);
  });

  it("should throw when no LLM provided", async () => {
    const { tree, pages } = makeTreeAndPages();
    const index = TreeDex.fromTree(tree, pages);
    await expect(index.query("question")).rejects.toThrow("No LLM provided");
  });
});

describe("TreeDex.save/load", () => {
  it("should save and load roundtrip", async () => {
    await mkdir(TMP_DIR, { recursive: true });
    const { tree, pages } = makeTreeAndPages();
    const llm = makeMockLlm();
    const index = TreeDex.fromTree(tree, pages, llm);

    const path = join(TMP_DIR, "index.json");
    await index.save(path);

    const raw = await readFile(path, "utf-8");
    expect(raw.length).toBeGreaterThan(0);

    const loaded = await TreeDex.load(path, llm);
    expect(loaded.stats().total_nodes).toBe(index.stats().total_nodes);
    expect(loaded.stats().total_pages).toBe(index.stats().total_pages);

    await rm(TMP_DIR, { recursive: true, force: true });
  });

  it("should load and query", async () => {
    await mkdir(TMP_DIR, { recursive: true });
    const { tree, pages } = makeTreeAndPages();
    const llm = makeMockLlm();
    const index = TreeDex.fromTree(tree, pages, llm);

    const path = join(TMP_DIR, "index2.json");
    await index.save(path);

    const loaded = await TreeDex.load(path, llm);
    const result = await loaded.query("test question");
    expect(result.nodeIds.length).toBeGreaterThan(0);

    await rm(TMP_DIR, { recursive: true, force: true });
  });
});

describe("TreeDex.findLargeSections", () => {
  it("should find large sections", () => {
    const { tree, pages } = makeTreeAndPages();
    const index = TreeDex.fromTree(tree, pages);
    const large = index.findLargeSections({ maxPages: 1 });
    expect(large.length).toBeGreaterThan(0);
  });

  it("should find no large sections with high threshold", () => {
    const { tree, pages } = makeTreeAndPages();
    const index = TreeDex.fromTree(tree, pages);
    const large = index.findLargeSections({ maxPages: 100 });
    expect(large.length).toBe(0);
  });
});

describe("MultiQueryResult", () => {
  it("should store results and labels", () => {
    const r1 = new QueryResult("ctx1", ["0001"], [[0, 1]], "reason1");
    const r2 = new QueryResult("ctx2", ["0002"], [[2, 3]], "reason2");
    const multi = new MultiQueryResult(
      [r1, r2],
      ["Doc A", "Doc B"],
      "[Doc A]\nctx1\n\n---\n\n[Doc B]\nctx2",
    );
    expect(multi.results).toHaveLength(2);
    expect(multi.labels).toEqual(["Doc A", "Doc B"]);
    expect(multi.combinedContext).toContain("[Doc A]");
    expect(multi.combinedContext).toContain("[Doc B]");
    expect(multi.answer).toBe("");
  });

  it("should store agentic answer", () => {
    const r = new QueryResult("ctx", ["0001"], [[0, 0]], "reason");
    const multi = new MultiQueryResult([r], ["Doc A"], "[Doc A]\nctx", "My answer");
    expect(multi.answer).toBe("My answer");
  });

  it("should have toString", () => {
    const r = new QueryResult("ctx", ["0001"], [[0, 0]], "reason");
    const multi = new MultiQueryResult([r], ["Doc A"], "[Doc A]\nctx");
    expect(multi.toString()).toContain("Doc A");
  });
});

describe("TreeDex.queryAll", () => {
  it("should query multiple indexes and merge contexts", async () => {
    const llm = makeMockLlm();
    const { tree, pages } = makeTreeAndPages();
    const index1 = TreeDex.fromTree(tree, pages, llm);
    const index2 = TreeDex.fromTree(tree, pages, llm);

    const multi = await TreeDex.queryAll([index1, index2], "What methods were used?");

    expect(multi.results).toHaveLength(2);
    expect(multi.labels).toEqual(["Document 1", "Document 2"]);
    expect(multi.combinedContext).toContain("[Document 1]");
    expect(multi.combinedContext).toContain("[Document 2]");
    expect(multi.combinedContext).toContain("---");
  });

  it("should use custom labels", async () => {
    const llm = makeMockLlm();
    const { tree, pages } = makeTreeAndPages();
    const index1 = TreeDex.fromTree(tree, pages, llm);
    const index2 = TreeDex.fromTree(tree, pages, llm);

    const multi = await TreeDex.queryAll(
      [index1, index2],
      "question",
      { labels: ["Manual A", "Manual B"] },
    );

    expect(multi.labels).toEqual(["Manual A", "Manual B"]);
    expect(multi.combinedContext).toContain("[Manual A]");
    expect(multi.combinedContext).toContain("[Manual B]");
  });

  it("should use shared override LLM", async () => {
    const { tree, pages } = makeTreeAndPages();
    const index1 = TreeDex.fromTree(tree, pages); // no llm
    const index2 = TreeDex.fromTree(tree, pages); // no llm
    const llm = makeMockLlm();

    const multi = await TreeDex.queryAll([index1, index2], "question", { llm });

    expect(multi.results).toHaveLength(2);
    expect(multi.combinedContext.length).toBeGreaterThan(0);
  });

  it("should generate agentic answer over combined context", async () => {
    const baseLlm = makeMockLlm();
    const agenticLlm = new FunctionLLM((prompt: string) => {
      if (prompt.includes("retrieval system")) {
        return JSON.stringify({ node_ids: ["0001"], reasoning: "relevant" });
      }
      return "The combined answer from all documents.";
    });

    const { tree, pages } = makeTreeAndPages();
    const index1 = TreeDex.fromTree(tree, pages, agenticLlm);

    const multi = await TreeDex.queryAll(
      [index1],
      "What is the answer?",
      { agentic: true },
    );

    expect(multi.answer).toBe("The combined answer from all documents.");
  });

  it("should throw for empty indexes array", async () => {
    await expect(TreeDex.queryAll([], "question")).rejects.toThrow(
      "queryAll requires at least one index",
    );
  });

  it("should throw when labels length mismatches", async () => {
    const llm = makeMockLlm();
    const { tree, pages } = makeTreeAndPages();
    const index = TreeDex.fromTree(tree, pages, llm);

    await expect(
      TreeDex.queryAll([index], "question", { labels: ["A", "B"] }),
    ).rejects.toThrow("labels length must match");
  });

  it("should have empty answer when not agentic", async () => {
    const llm = makeMockLlm();
    const { tree, pages } = makeTreeAndPages();
    const index = TreeDex.fromTree(tree, pages, llm);

    const multi = await TreeDex.queryAll([index], "question");

    expect(multi.answer).toBe("");
  });
});
