/** TreeDex: Tree-based document RAG framework. */

import { autoLoader } from "./loaders.js";
import { groupPages, extractToc } from "./pdf-parser.js";
import {
  assignNodeIds,
  assignPageRanges,
  embedTextInTree,
  findLargeNodes,
  listToTree,
  repairOrphans,
  tocToSections,
} from "./tree-builder.js";
import {
  collectNodeTexts,
  countNodes,
  createNodeMapping,
  extractJson,
  getLeafNodes,
  printTree,
  stripTextFromTree,
} from "./tree-utils.js";
import {
  structureExtractionPrompt,
  structureContinuePrompt,
  retrievalPrompt,
  answerPrompt,
  imageDescriptionPrompt,
} from "./prompts.js";
import { countTokens } from "./pdf-parser.js";
import type { Page, TreeNode, IndexData, Stats } from "./types.js";
import type { BaseLLM } from "./llm-backends.js";

/** Append image descriptions to page text, modifying pages in place. */
async function describeImages(
  pages: Page[],
  llm?: BaseLLM | null,
  verbose: boolean = false,
): Promise<void> {
  for (const page of pages) {
    if (!page.images || page.images.length === 0) continue;

    const descriptions: string[] = [];
    for (const img of page.images) {
      const alt = (img.alt_text ?? "").trim();
      if (alt) {
        descriptions.push(`[Image: ${alt}]`);
      } else if (llm?.supportsVision && img.data) {
        try {
          const desc = await llm.generateWithImage(
            imageDescriptionPrompt(),
            img.data,
            img.mime_type,
          );
          descriptions.push(`[Image: ${desc.trim()}]`);
        } catch {
          descriptions.push("[Image present]");
        }
      } else {
        descriptions.push("[Image present]");
      }
    }

    if (descriptions.length > 0) {
      page.text = page.text + "\n" + descriptions.join("\n");
      page.token_count = countTokens(page.text);
    }

    if (verbose && descriptions.length > 0) {
      console.log(`  Page ${page.page_num}: ${descriptions.length} image(s) described`);
    }
  }
}

/**
 * Build a capped continuation context for structure extraction.
 *
 * For small section lists returns the full JSON. For large lists returns a
 * summary with top-level sections and the most recent sections.
 */
function buildContinuationContext(
  allSections: Array<{ structure: string; [key: string]: unknown }>,
  maxRecent: number = 30,
): string {
  if (allSections.length <= maxRecent) {
    return JSON.stringify(allSections, null, 2);
  }

  const topLevel = allSections.filter((s) => !s.structure.includes("."));
  const recent = allSections.slice(-maxRecent);

  const summary = {
    top_level_sections: topLevel,
    [`recent_sections (last ${maxRecent})`]: recent,
    total_sections_so_far: allSections.length,
    last_structure_id: allSections[allSections.length - 1].structure,
  };
  return JSON.stringify(summary, null, 2);
}

/** Result of a TreeDex query. */
export class QueryResult {
  readonly context: string;
  readonly nodeIds: string[];
  readonly pageRanges: [number, number][];
  readonly reasoning: string;
  readonly answer: string;

  constructor(
    context: string,
    nodeIds: string[],
    pageRanges: [number, number][],
    reasoning: string,
    answer: string = "",
  ) {
    this.context = context;
    this.nodeIds = nodeIds;
    this.pageRanges = pageRanges;
    this.reasoning = reasoning;
    this.answer = answer;
  }

  /** Human-readable page ranges like 'pages 5-8, 12-15'. */
  get pagesStr(): string {
    if (this.pageRanges.length === 0) return "no pages";
    const parts: string[] = [];
    for (const [start, end] of this.pageRanges) {
      if (start === end) {
        parts.push(String(start + 1));
      } else {
        parts.push(`${start + 1}-${end + 1}`);
      }
    }
    return "pages " + parts.join(", ");
  }

  toString(): string {
    return (
      `QueryResult(nodes=${JSON.stringify(this.nodeIds)}, ${this.pagesStr}, ` +
      `context_len=${this.context.length})`
    );
  }
}

/** Result of querying multiple TreeDex indexes simultaneously. */
export class MultiQueryResult {
  /** Per-index results in the same order as the input indexes. */
  readonly results: QueryResult[];
  /** Labels for each index (e.g. filenames or custom names). */
  readonly labels: string[];
  /** All per-index contexts merged with [Document N] separators. */
  readonly combinedContext: string;
  /** Optional agentic answer generated over the combined context. */
  readonly answer: string;

  constructor(
    results: QueryResult[],
    labels: string[],
    combinedContext: string,
    answer: string = "",
  ) {
    this.results = results;
    this.labels = labels;
    this.combinedContext = combinedContext;
    this.answer = answer;
  }

  toString(): string {
    const parts = this.results.map(
      (r, i) => `[${this.labels[i]}] ${r.toString()}`,
    );
    return `MultiQueryResult(\n  ${parts.join(",\n  ")}\n)`;
  }
}

/** Tree-based document index for RAG retrieval. */
export class TreeDex {
  readonly tree: TreeNode[];
  readonly pages: Page[];
  llm: BaseLLM | null;
  private _nodeMap: Record<string, TreeNode>;

  constructor(tree: TreeNode[], pages: Page[], llm: BaseLLM | null = null) {
    this.tree = tree;
    this.pages = pages;
    this.llm = llm;
    this._nodeMap = createNodeMapping(tree);
  }

  /**
   * Build a TreeDex index from a file.
   *
   * @param path - Path to document (PDF, TXT, HTML, DOCX)
   * @param llm - LLM backend with .generate(prompt) method
   * @param options - Optional configuration
   */
  static async fromFile(
    path: string,
    llm: BaseLLM,
    options?: {
      loader?: { load(path: string): Promise<Page[]> };
      maxTokens?: number;
      overlap?: number;
      verbose?: boolean;
      extractImages?: boolean;
    },
  ): Promise<TreeDex> {
    const {
      loader,
      maxTokens = 20000,
      overlap = 1,
      verbose = true,
      extractImages = false,
    } = options ?? {};

    if (verbose) {
      const { basename } = await import("node:path");
      console.log(`Loading: ${basename(path)}`);
    }

    const isPdf = path.toLowerCase().endsWith(".pdf");

    // --- Try PDF ToC shortcut ---
    let toc: Awaited<ReturnType<typeof extractToc>> = null;
    if (isPdf && !loader) {
      toc = await extractToc(path);
      if (toc && verbose) {
        console.log(`  Found PDF table of contents (${toc.length} entries)`);
      }
    }

    // Load pages — enable heading detection for PDFs when no ToC
    let pages: Page[];
    if (loader) {
      pages = await loader.load(path);
    } else {
      pages = await autoLoader(path, {
        extractImages,
        detectHeadings: isPdf && toc === null,
      });
    }

    if (verbose) {
      const totalTokens = pages.reduce((s, p) => s + p.token_count, 0);
      console.log(`  ${pages.length} pages, ${totalTokens.toLocaleString()} tokens`);
    }

    // If we have a ToC, build the tree directly — no LLM needed
    if (toc) {
      return TreeDex._fromToc(toc, pages, llm, verbose);
    }

    return TreeDex.fromPages(pages, llm, { maxTokens, overlap, verbose });
  }

  /** Build a TreeDex index directly from PDF table of contents. */
  private static _fromToc(
    toc: Array<{ level: number; title: string; physical_index: number }>,
    pages: Page[],
    llm: BaseLLM,
    verbose: boolean = true,
  ): TreeDex {
    const sections = tocToSections(toc);

    if (verbose) {
      console.log(`  Built ${sections.length} sections from PDF ToC (no LLM needed)`);
    }

    const tree = listToTree(sections);
    assignPageRanges(tree, pages.length);
    assignNodeIds(tree);
    embedTextInTree(tree, pages);

    if (verbose) {
      console.log(`  Tree: ${countNodes(tree)} nodes`);
    }

    return new TreeDex(tree, pages, llm);
  }

  /** Build a TreeDex index from pre-extracted pages. */
  static async fromPages(
    pages: Page[],
    llm: BaseLLM,
    options?: {
      maxTokens?: number;
      overlap?: number;
      verbose?: boolean;
    },
  ): Promise<TreeDex> {
    const { maxTokens = 20000, overlap = 1, verbose = true } = options ?? {};

    // Describe images before grouping — appends text markers to pages
    await describeImages(pages, llm, verbose);

    const groups = groupPages(pages, maxTokens, overlap);

    if (verbose) {
      console.log(`  ${groups.length} page group(s) for structure extraction`);
    }

    const allSections: Array<{
      structure: string;
      title: string;
      physical_index: number;
    }> = [];

    for (let i = 0; i < groups.length; i++) {
      if (verbose) {
        console.log(
          `  Extracting structure from group ${i + 1}/${groups.length}...`,
        );
      }

      let prompt: string;
      if (i === 0) {
        prompt = structureExtractionPrompt(groups[i]);
      } else {
        const prevContext = buildContinuationContext(allSections);
        prompt = structureContinuePrompt(prevContext, groups[i]);
      }

      const response = await llm.generate(prompt);
      const sections = extractJson(response);

      if (Array.isArray(sections)) {
        allSections.push(
          ...(sections as Array<{
            structure: string;
            title: string;
            physical_index: number;
          }>),
        );
      } else if (
        sections !== null &&
        typeof sections === "object" &&
        "sections" in (sections as Record<string, unknown>)
      ) {
        allSections.push(
          ...((sections as { sections: Array<{ structure: string; title: string; physical_index: number }> }).sections),
        );
      }
    }

    if (verbose) {
      console.log(`  Extracted ${allSections.length} sections`);
    }

    // Repair orphaned sections before building the tree
    const repairedSections = repairOrphans(allSections);

    // Build tree
    const tree = listToTree(repairedSections);
    assignPageRanges(tree, pages.length);
    assignNodeIds(tree);
    embedTextInTree(tree, pages);

    if (verbose) {
      console.log(`  Tree: ${countNodes(tree)} nodes`);
    }

    return new TreeDex(tree, pages, llm);
  }

  /** Create a TreeDex from an existing tree and pages. */
  static fromTree(
    tree: TreeNode[],
    pages: Page[],
    llm: BaseLLM | null = null,
  ): TreeDex {
    return new TreeDex(tree, pages, llm);
  }

  /**
   * Query the index and return relevant context.
   *
   * @param question - The user's question
   * @param options - Optional LLM override or agentic mode
   */
  async query(
    question: string,
    options?: BaseLLM | { llm?: BaseLLM; agentic?: boolean },
  ): Promise<QueryResult> {
    // Support both query(q, llm) and query(q, { llm, agentic })
    let activeLlm: BaseLLM | null;
    let agentic = false;

    if (options && typeof (options as BaseLLM).generate === "function") {
      activeLlm = options as BaseLLM;
    } else if (options && typeof options === "object") {
      const opts = options as { llm?: BaseLLM; agentic?: boolean };
      activeLlm = opts.llm ?? this.llm;
      agentic = opts.agentic ?? false;
    } else {
      activeLlm = this.llm;
    }

    if (!activeLlm) {
      throw new Error(
        "No LLM provided. Pass llm to query() or TreeDex constructor.",
      );
    }

    // Build lightweight tree structure for the prompt
    const stripped = stripTextFromTree(this.tree);
    const treeJson = JSON.stringify(stripped, null, 2);

    const prompt = retrievalPrompt(treeJson, question);
    const response = await activeLlm.generate(prompt);
    const result = extractJson(response) as {
      node_ids?: string[];
      reasoning?: string;
    };

    const nodeIds = result.node_ids ?? [];
    const reasoning = result.reasoning ?? "";

    // Collect context text and page ranges
    const context = collectNodeTexts(nodeIds, this._nodeMap);

    const pageRanges: [number, number][] = [];
    for (const nid of nodeIds) {
      const node = this._nodeMap[nid];
      if (node) {
        const start = node.start_index ?? 0;
        const end = node.end_index ?? 0;
        pageRanges.push([start, end]);
      }
    }

    // Agentic mode: generate an answer from the retrieved context
    let answer = "";
    if (agentic && context.length > 0) {
      const aPrompt = answerPrompt(context, question);
      answer = await activeLlm.generate(aPrompt);
    }

    return new QueryResult(context, nodeIds, pageRanges, reasoning, answer);
  }

  /** Save the index to a JSON file. */
  async save(path: string): Promise<string> {
    const fs = await import("node:fs/promises");
    const stripped = stripTextFromTree(this.tree);

    // Strip images from pages — descriptions are already in text
    const cleanPages: Page[] = this.pages.map(({ images: _images, ...rest }) => rest);

    const data: IndexData = {
      version: "1.0",
      framework: "TreeDex",
      tree: stripped,
      pages: cleanPages,
    };

    await fs.writeFile(path, JSON.stringify(data, null, 2), "utf-8");
    return path;
  }

  /** Load a TreeDex index from a JSON file. */
  static async load(path: string, llm?: BaseLLM | null): Promise<TreeDex> {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(path, "utf-8");
    const data = JSON.parse(raw) as IndexData;

    const tree = data.tree;
    const pages = data.pages;

    // Re-embed text from pages
    assignPageRanges(tree, pages.length);
    embedTextInTree(tree, pages);

    return new TreeDex(tree, pages, llm ?? null);
  }

  /** Pretty-print the tree structure. */
  showTree(): void {
    printTree(this.tree);
  }

  /** Return index statistics. */
  stats(): Stats {
    const totalTokens = this.pages.reduce((s, p) => s + p.token_count, 0);
    const leaves = getLeafNodes(this.tree);
    return {
      total_pages: this.pages.length,
      total_tokens: totalTokens,
      total_nodes: countNodes(this.tree),
      leaf_nodes: leaves.length,
      root_sections: this.tree.length,
    };
  }

  /** Find sections that exceed size thresholds. */
  findLargeSections(options?: {
    maxPages?: number;
    maxTokens?: number;
  }): TreeNode[] {
    return findLargeNodes(this.tree, {
      maxPages: options?.maxPages ?? 10,
      maxTokens: options?.maxTokens ?? 20000,
      pages: this.pages,
    });
  }

  /**
   * Query multiple TreeDex indexes simultaneously and merge results.
   *
   * All indexes are queried in parallel. Results are combined into a single
   * `MultiQueryResult` with a `combinedContext` that labels each source.
   *
   * @param indexes - Array of TreeDex instances to query.
   * @param question - The question to ask each index.
   * @param options - Shared LLM, optional per-index labels, and agentic mode.
   *
   * @example
   * const multi = await TreeDex.queryAll(
   *   [index1, index2, index3],
   *   "What are the safety guidelines?",
   *   { llm, labels: ["Manual A", "Manual B", "Manual C"], agentic: true },
   * );
   * console.log(multi.combinedContext);
   * console.log(multi.answer);
   */
  static async queryAll(
    indexes: TreeDex[],
    question: string,
    options?: {
      llm?: BaseLLM;
      agentic?: boolean;
      labels?: string[];
    },
  ): Promise<MultiQueryResult> {
    if (indexes.length === 0) {
      throw new Error("queryAll requires at least one index.");
    }

    const llm = options?.llm;
    const agentic = options?.agentic ?? false;
    const labels = options?.labels ?? indexes.map((_, i) => `Document ${i + 1}`);

    if (labels.length !== indexes.length) {
      throw new Error("labels length must match indexes length.");
    }

    if (!llm && indexes.some((idx) => idx.llm === null)) {
      throw new Error(
        "No LLM provided for one or more indexes. Pass options.llm or set llm on every TreeDex.",
      );
    }

    // Query all indexes in parallel (no agentic per-index; answer at the end)
    const results = await Promise.all(
      indexes.map((idx) => idx.query(question, { llm, agentic: false })),
    );

    // Merge contexts with clear document separators
    const sections: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const ctx = results[i].context.trim();
      if (ctx.length > 0) {
        sections.push(`[${labels[i]}]\n${ctx}`);
      }
    }
    const combinedContext = sections.join("\n\n---\n\n");

    // Optional: generate a single answer over all combined context
    let answer = "";
    if (agentic && combinedContext.length > 0) {
      const activeLlm = llm ?? indexes.find((idx) => idx.llm)?.llm ?? null;
      if (!activeLlm) {
        throw new Error("No LLM provided for agentic mode in queryAll.");
      }
      answer = await activeLlm.generate(answerPrompt(combinedContext, question));
    }

    return new MultiQueryResult(results, labels, combinedContext, answer);
  }
}
