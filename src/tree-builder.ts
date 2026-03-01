/** Tree construction utilities. */

import type { TreeNode, Page } from "./types.js";

/**
 * Convert a flat list with `structure` fields into a hierarchical tree.
 *
 * Each item must have a `structure` field like "1", "1.1", "1.2.3".
 * Parent of "1.2.3" is "1.2", parent of "1.2" is "1", "1" is root.
 * Output nodes get a `nodes: []` field for children.
 */
export function listToTree(
  flatList: Array<{
    structure: string;
    title: string;
    physical_index: number;
    [key: string]: unknown;
  }>,
): TreeNode[] {
  const nodesByStructure: Record<string, TreeNode> = {};
  const roots: TreeNode[] = [];

  for (const item of flatList) {
    const node: TreeNode = { ...item, nodes: [] };
    const structure = node.structure;
    nodesByStructure[structure] = node;

    const parts = structure.split(".");
    if (parts.length === 1) {
      roots.push(node);
    } else {
      const parentStructure = parts.slice(0, -1).join(".");
      const parent = nodesByStructure[parentStructure];
      if (parent !== undefined) {
        parent.nodes.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  return roots;
}

function assignRanges(nodes: TreeNode[], boundaryEnd: number): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    node.start_index = node.physical_index ?? 0;

    if (i + 1 < nodes.length) {
      node.end_index = (nodes[i + 1].physical_index ?? 0) - 1;
    } else {
      node.end_index = boundaryEnd;
    }

    // Clamp: end must be >= start (sections on the same page)
    if (node.end_index < node.start_index) {
      node.end_index = node.start_index;
    }

    if (node.nodes.length > 0) {
      assignRanges(node.nodes, node.end_index);
    }
  }
}

/**
 * Set start_index and end_index on each node.
 *
 * - start_index = node's physical_index
 * - end_index = next sibling's physical_index - 1, or parent's end,
 *   or total_pages - 1 for the last root node
 */
export function assignPageRanges(
  tree: TreeNode[],
  totalPages: number,
): TreeNode[] {
  assignRanges(tree, totalPages - 1);
  return tree;
}

/** DFS traversal, assigns sequential IDs: '0001', '0002', etc. */
export function assignNodeIds(tree: TreeNode[]): TreeNode[] {
  let counter = 0;

  function walk(nodes: TreeNode[]): void {
    for (const node of nodes) {
      counter++;
      node.node_id = String(counter).padStart(4, "0");
      walk(node.nodes);
    }
  }

  walk(tree);
  return tree;
}

/** Return nodes that exceed page or token thresholds. */
export function findLargeNodes(
  tree: TreeNode[],
  options: {
    maxPages?: number;
    maxTokens?: number;
    pages?: Page[] | null;
  } = {},
): TreeNode[] {
  const { maxPages = 10, maxTokens = 20000, pages = null } = options;
  const large: TreeNode[] = [];

  function walk(nodes: TreeNode[]): void {
    for (const node of nodes) {
      const start = node.start_index ?? 0;
      const end = node.end_index ?? 0;
      const pageCount = end - start + 1;

      let isLarge = pageCount > maxPages;

      if (!isLarge && pages !== null) {
        const tokenSum = pages
          .filter((p) => p.page_num >= start && p.page_num <= end)
          .reduce((sum, p) => sum + p.token_count, 0);
        isLarge = tokenSum > maxTokens;
      }

      if (isLarge) {
        large.push(node);
      }

      walk(node.nodes);
    }
  }

  walk(tree);
  return large;
}

/** Add `text` field to each node by concatenating page text for its range. */
export function embedTextInTree(
  tree: TreeNode[],
  pages: Page[],
): TreeNode[] {
  function walk(nodes: TreeNode[]): void {
    for (const node of nodes) {
      const start = node.start_index ?? 0;
      const end = node.end_index ?? 0;
      node.text = pages
        .filter((p) => p.page_num >= start && p.page_num <= end)
        .map((p) => p.text)
        .join("\n");
      walk(node.nodes);
    }
  }

  walk(tree);
  return tree;
}
