/** TreeDex: Tree-based document RAG framework. */

import { autoLoader } from "./loaders.js";
import { groupPages } from "./pdf-parser.js";
import {
  assignNodeIds,
  assignPageRanges,
  embedTextInTree,
  findLargeNodes,
  listToTree,
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
} from "./prompts.js";
import type { Page, TreeNode, IndexData, Stats } from "./types.js";
import type { BaseLLM } from "./llm-backends.js";

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
    },
  ): Promise<TreeDex> {
    const {
      loader,
      maxTokens = 20000,
      overlap = 1,
      verbose = true,
    } = options ?? {};

    if (verbose) {
      const { basename } = await import("node:path");
      console.log(`Loading: ${basename(path)}`);
    }

    let pages: Page[];
    if (loader) {
      pages = await loader.load(path);
    } else {
      pages = await autoLoader(path);
    }

    if (verbose) {
      const totalTokens = pages.reduce((s, p) => s + p.token_count, 0);
      console.log(`  ${pages.length} pages, ${totalTokens.toLocaleString()} tokens`);
    }

    return TreeDex.fromPages(pages, llm, { maxTokens, overlap, verbose });
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
        const prevJson = JSON.stringify(allSections, null, 2);
        prompt = structureContinuePrompt(prevJson, groups[i]);
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

    // Build tree
    const tree = listToTree(allSections);
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

    const data: IndexData = {
      version: "1.0",
      framework: "TreeDex",
      tree: stripped,
      pages: this.pages,
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
}
