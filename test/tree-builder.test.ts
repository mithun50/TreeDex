import { describe, it, expect } from "vitest";
import {
  listToTree,
  assignPageRanges,
  assignNodeIds,
  findLargeNodes,
  embedTextInTree,
} from "../src/tree-builder.js";
import type { Page, TreeNode } from "../src/types.js";

function makeTestData() {
  return [
    { structure: "1", title: "Ch1: Physical World", physical_index: 0 },
    { structure: "1.1", title: "What is Physics?", physical_index: 0 },
    { structure: "1.2", title: "Scope and Excitement", physical_index: 5 },
    { structure: "1.2.1", title: "Classical Physics", physical_index: 5 },
    { structure: "1.2.2", title: "Modern Physics", physical_index: 8 },
    { structure: "1.3", title: "Physics and Technology", physical_index: 12 },
    {
      structure: "2",
      title: "Ch2: Units and Measurements",
      physical_index: 18,
    },
    { structure: "2.1", title: "Introduction", physical_index: 18 },
    { structure: "2.2", title: "SI Units", physical_index: 22 },
  ];
}

function makeFakePages(n: number = 30): Page[] {
  return Array.from({ length: n }, (_, i) => ({
    page_num: i,
    text: `Page ${i} content.`,
    token_count: 10,
  }));
}

describe("listToTree", () => {
  it("should create 2 root nodes", () => {
    const tree = listToTree(makeTestData());
    expect(tree.length).toBe(2);
  });

  it("should have correct children count", () => {
    const tree = listToTree(makeTestData());
    expect(tree[0].nodes.length).toBe(3); // 1.1, 1.2, 1.3
    expect(tree[1].nodes.length).toBe(2); // 2.1, 2.2
  });

  it("should handle nested children", () => {
    const tree = listToTree(makeTestData());
    const sec12 = tree[0].nodes[1];
    expect(sec12.nodes.length).toBe(2); // 1.2.1, 1.2.2
  });

  it("should make orphan a root", () => {
    const data = [
      { structure: "3.1", title: "Orphan", physical_index: 0 },
    ];
    const tree = listToTree(data);
    expect(tree.length).toBe(1);
    expect(tree[0].title).toBe("Orphan");
  });

  it("should return empty for empty input", () => {
    expect(listToTree([])).toEqual([]);
  });
});

describe("assignPageRanges", () => {
  it("should assign ranges to root nodes", () => {
    const tree = listToTree(makeTestData());
    assignPageRanges(tree, 30);

    expect(tree[0].start_index).toBe(0);
    expect(tree[0].end_index).toBe(17);
    expect(tree[1].start_index).toBe(18);
    expect(tree[1].end_index).toBe(29);
  });

  it("should assign correct leaf ranges", () => {
    const tree = listToTree(makeTestData());
    assignPageRanges(tree, 30);

    const modernPhysics = tree[0].nodes[1].nodes[1]; // 1.2.2
    expect(modernPhysics.start_index).toBe(8);
    expect(modernPhysics.end_index).toBe(11); // up to 1.3 start - 1
  });
});

describe("assignNodeIds", () => {
  it("should assign sequential IDs", () => {
    const tree = listToTree(makeTestData());
    assignNodeIds(tree);

    expect(tree[0].node_id).toBe("0001");
    expect(tree[0].nodes[0].node_id).toBe("0002");
  });

  it("should assign IDs to all nodes", () => {
    const tree = listToTree(makeTestData());
    assignNodeIds(tree);

    const ids = new Set<string>();
    function collect(nodes: TreeNode[]) {
      for (const n of nodes) {
        if (n.node_id) ids.add(n.node_id);
        collect(n.nodes);
      }
    }
    collect(tree);
    expect(ids.size).toBe(9);
  });
});

describe("findLargeNodes", () => {
  it("should find large nodes by pages", () => {
    const tree = listToTree(makeTestData());
    assignPageRanges(tree, 30);

    const large = findLargeNodes(tree, { maxPages: 5 });
    const titles = large.map((n) => n.title);
    expect(titles).toContain("Ch1: Physical World");
    expect(titles).toContain("Ch2: Units and Measurements");
  });

  it("should find large nodes by tokens", () => {
    const tree = listToTree(makeTestData());
    assignPageRanges(tree, 30);
    const pages = makeFakePages(30);

    const large = findLargeNodes(tree, {
      maxPages: 100,
      maxTokens: 50,
      pages,
    });
    expect(large.length).toBeGreaterThan(0);
  });

  it("should find no large nodes when thresholds are high", () => {
    const tree = listToTree(makeTestData());
    assignPageRanges(tree, 30);

    const large = findLargeNodes(tree, { maxPages: 100, maxTokens: 999999 });
    expect(large.length).toBe(0);
  });
});

describe("embedTextInTree", () => {
  it("should embed text in nodes", () => {
    const tree = listToTree(makeTestData());
    assignPageRanges(tree, 30);
    const pages = makeFakePages(30);

    embedTextInTree(tree, pages);

    expect(tree[0].text).toBeDefined();
    expect(tree[0].text).toContain("Page 0 content.");
  });

  it("should embed correct text in leaf nodes", () => {
    const tree = listToTree(makeTestData());
    assignPageRanges(tree, 30);
    const pages = makeFakePages(30);

    embedTextInTree(tree, pages);

    const siUnits = tree[1].nodes[1]; // 2.2
    expect(siUnits.text).toContain("Page 22 content.");
  });
});
