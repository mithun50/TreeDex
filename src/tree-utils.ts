/** Tree manipulation and utility functions. */

import type { TreeNode } from "./types.js";

/** Flatten tree into {node_id: node_dict} for O(1) lookups. */
export function createNodeMapping(tree: TreeNode[]): Record<string, TreeNode> {
  const mapping: Record<string, TreeNode> = {};

  function walk(nodes: TreeNode[]): void {
    for (const node of nodes) {
      if (node.node_id !== undefined) {
        mapping[node.node_id] = node;
      }
      walk(node.nodes);
    }
  }

  walk(tree);
  return mapping;
}

/** Return a deep copy of the tree with all `text` fields removed. */
export function stripTextFromTree(tree: TreeNode[]): TreeNode[] {
  const stripped: TreeNode[] = JSON.parse(JSON.stringify(tree));

  function strip(nodes: TreeNode[]): void {
    for (const node of nodes) {
      delete node.text;
      strip(node.nodes);
    }
  }

  strip(stripped);
  return stripped;
}

/**
 * Gather and concatenate text from a list of node IDs.
 *
 * Format:
 *     [Section: Title]
 *     text
 *
 *     [Section: Title2]
 *     text2
 */
export function collectNodeTexts(
  nodeIds: string[],
  nodeMap: Record<string, TreeNode>,
): string {
  const parts: string[] = [];
  for (const nid of nodeIds) {
    const node = nodeMap[nid];
    if (node === undefined) continue;
    const title = node.title ?? "Untitled";
    const structure = node.structure ?? "";
    const text = node.text ?? "";
    const header = structure ? `[${structure}: ${title}]` : `[${title}]`;
    parts.push(`${header}\n${text}`);
  }
  return parts.join("\n\n");
}

/** Recursively count total nodes in the tree. */
export function countNodes(tree: TreeNode[]): number {
  let total = 0;
  for (const node of tree) {
    total += 1;
    total += countNodes(node.nodes);
  }
  return total;
}

/** Return all nodes with empty `nodes` list. */
export function getLeafNodes(tree: TreeNode[]): TreeNode[] {
  const leaves: TreeNode[] = [];

  function walk(nodes: TreeNode[]): void {
    for (const node of nodes) {
      if (node.nodes.length === 0) {
        leaves.push(node);
      } else {
        walk(node.nodes);
      }
    }
  }

  walk(tree);
  return leaves;
}

/** Flatten hierarchy back to a list in DFS order. */
export function treeToFlatList(
  tree: TreeNode[],
): Array<Omit<TreeNode, "nodes">> {
  const result: Array<Omit<TreeNode, "nodes">> = [];

  function walk(nodes: TreeNode[]): void {
    for (const node of nodes) {
      const { nodes: children, ...flat } = node;
      result.push(flat);
      walk(children);
    }
  }

  walk(tree);
  return result;
}

/**
 * Robust JSON extraction from LLM responses.
 *
 * Handles raw JSON, ```json code blocks, and minor formatting issues
 * like trailing commas.
 */
export function extractJson(text: string): unknown {
  // Try direct parse
  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  // Try code block
  const blockMatch = text.match(/```(?:json)?\s*\n?(.*?)```/s);
  if (blockMatch) {
    const block = blockMatch[1].trim();
    try {
      return JSON.parse(block);
    } catch {
      const cleaned = block.replace(/,\s*([}\]])/g, "$1");
      try {
        return JSON.parse(cleaned);
      } catch {
        // continue
      }
    }
  }

  // Try finding JSON by matching braces/brackets
  for (const [startChar, endChar] of [
    ["{", "}"],
    ["[", "]"],
  ] as const) {
    const start = text.indexOf(startChar);
    if (start === -1) continue;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === startChar) depth++;
      else if (text[i] === endChar) {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            const cleaned = candidate.replace(/,\s*([}\]])/g, "$1");
            try {
              return JSON.parse(cleaned);
            } catch {
              break;
            }
          }
        }
      }
    }
  }

  throw new Error(
    `Could not extract JSON from text: ${text.slice(0, 200)}...`,
  );
}

/** Pretty-print tree structure for debugging. */
export function printTree(tree: TreeNode[], indent: number = 0): void {
  const prefix = "  ".repeat(indent);
  for (const node of tree) {
    const nodeId = node.node_id ?? "????";
    const structure = node.structure ?? "";
    const title = node.title ?? "Untitled";
    const start = node.start_index ?? "?";
    const end = node.end_index ?? "?";
    console.log(
      `${prefix}[${nodeId}] ${structure}: ${title} (pages ${start}-${end})`,
    );
    printTree(node.nodes, indent + 1);
  }
}
