import { useMemo } from "react";
import { TreeNode, TREE_ROOT, flattenTree } from "../constants/tree-data";

export interface NodeLayout {
  nodeId: string;
  title: string;
  structure: string;
  x: number;
  y: number;
  depth: number;
  index: number; // BFS order index
}

export interface EdgeLayout {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * BFS layout of tree in 2D SVG coordinates.
 * @param width  SVG viewport width
 * @param height SVG viewport height
 * @param padX   horizontal padding
 * @param padY   vertical padding
 */
export function useTreeLayout2D(
  width = 700,
  height = 500,
  padX = 40,
  padY = 60,
): { nodes: NodeLayout[]; edges: EdgeLayout[] } {
  return useMemo(() => {
    const nodes: NodeLayout[] = [];
    const nodeMap = new Map<string, NodeLayout>();

    // BFS to assign depth + children grouping
    interface QueueItem {
      node: TreeNode;
      depth: number;
    }

    const queue: QueueItem[] = [{ node: TREE_ROOT, depth: 0 }];
    const levels: TreeNode[][] = [];
    let bfsIndex = 0;

    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;
      if (!levels[depth]) levels[depth] = [];
      levels[depth].push(node);

      for (const child of node.children) {
        queue.push({ node: child, depth: depth + 1 });
      }
    }

    const maxDepth = levels.length - 1;
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;

    // Assign positions per level
    for (let d = 0; d <= maxDepth; d++) {
      const row = levels[d];
      const y = padY + (maxDepth > 0 ? (d / maxDepth) * usableH : usableH / 2);

      for (let i = 0; i < row.length; i++) {
        const x =
          padX +
          (row.length > 1 ? (i / (row.length - 1)) * usableW : usableW / 2);

        const layout: NodeLayout = {
          nodeId: row[i].nodeId,
          title: row[i].title,
          structure: row[i].structure,
          x,
          y,
          depth: d,
          index: bfsIndex++,
        };
        nodes.push(layout);
        nodeMap.set(row[i].nodeId, layout);
      }
    }

    // Compute edges
    const edges: EdgeLayout[] = [];
    const allNodes = flattenTree(TREE_ROOT);

    for (const node of allNodes) {
      const parentLayout = nodeMap.get(node.nodeId);
      if (!parentLayout) continue;
      for (const child of node.children) {
        const childLayout = nodeMap.get(child.nodeId);
        if (!childLayout) continue;
        edges.push({
          from: node.nodeId,
          to: child.nodeId,
          x1: parentLayout.x,
          y1: parentLayout.y,
          x2: childLayout.x,
          y2: childLayout.y,
        });
      }
    }

    return { nodes, edges };
  }, [width, height, padX, padY]);
}
