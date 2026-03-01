import { describe, it, expect, vi } from "vitest";
import {
  listToTree,
  assignPageRanges,
  assignNodeIds,
  embedTextInTree,
} from "../src/tree-builder.js";
import {
  createNodeMapping,
  stripTextFromTree,
  collectNodeTexts,
  countNodes,
  getLeafNodes,
  treeToFlatList,
  extractJson,
  printTree,
} from "../src/tree-utils.js";
import type { TreeNode } from "../src/types.js";

function makeTree() {
  const data = [
    { structure: "1", title: "Chapter 1", physical_index: 0 },
    { structure: "1.1", title: "Section 1.1", physical_index: 0 },
    { structure: "1.2", title: "Section 1.2", physical_index: 5 },
    { structure: "2", title: "Chapter 2", physical_index: 10 },
    { structure: "2.1", title: "Section 2.1", physical_index: 10 },
  ];
  const tree = listToTree(data);
  assignPageRanges(tree, 20);
  assignNodeIds(tree);
  const pages = Array.from({ length: 20 }, (_, i) => ({
    page_num: i,
    text: `Content of page ${i}.`,
    token_count: 10,
  }));
  embedTextInTree(tree, pages);
  return { tree, pages };
}

describe("createNodeMapping", () => {
  it("should map all nodes", () => {
    const { tree } = makeTree();
    const mapping = createNodeMapping(tree);
    expect(Object.keys(mapping).length).toBe(5);
  });

  it("should look up by ID", () => {
    const { tree } = makeTree();
    const mapping = createNodeMapping(tree);
    expect(mapping["0001"].title).toBe("Chapter 1");
    expect(mapping["0004"].title).toBe("Chapter 2");
  });
});

describe("stripTextFromTree", () => {
  it("should remove text fields", () => {
    const { tree } = makeTree();
    const stripped = stripTextFromTree(tree);

    function check(nodes: TreeNode[]) {
      for (const n of nodes) {
        expect(n.text).toBeUndefined();
        check(n.nodes);
      }
    }
    check(stripped);
  });

  it("should not modify original tree", () => {
    const { tree } = makeTree();
    stripTextFromTree(tree);
    expect(tree[0].text).toBeDefined();
  });
});

describe("collectNodeTexts", () => {
  it("should collect text from nodes", () => {
    const { tree } = makeTree();
    const mapping = createNodeMapping(tree);
    const result = collectNodeTexts(["0002", "0005"], mapping);
    expect(result).toContain("[1.1: Section 1.1]");
    expect(result).toContain("[2.1: Section 2.1]");
  });

  it("should handle missing node", () => {
    const { tree } = makeTree();
    const mapping = createNodeMapping(tree);
    const result = collectNodeTexts(["9999"], mapping);
    expect(result).toBe("");
  });
});

describe("countNodes", () => {
  it("should count total nodes", () => {
    const { tree } = makeTree();
    expect(countNodes(tree)).toBe(5);
  });

  it("should return 0 for empty tree", () => {
    expect(countNodes([])).toBe(0);
  });
});

describe("getLeafNodes", () => {
  it("should return correct leaf count", () => {
    const { tree } = makeTree();
    const leaves = getLeafNodes(tree);
    expect(leaves.length).toBe(3); // 1.1, 1.2, 2.1
  });

  it("should return correct leaf titles", () => {
    const { tree } = makeTree();
    const leaves = getLeafNodes(tree);
    const titles = new Set(leaves.map((n) => n.title));
    expect(titles).toEqual(
      new Set(["Section 1.1", "Section 1.2", "Section 2.1"]),
    );
  });
});

describe("treeToFlatList", () => {
  it("should have correct length", () => {
    const { tree } = makeTree();
    const flat = treeToFlatList(tree);
    expect(flat.length).toBe(5);
  });

  it("should not have nodes field", () => {
    const { tree } = makeTree();
    const flat = treeToFlatList(tree);
    for (const item of flat) {
      expect("nodes" in item).toBe(false);
    }
  });

  it("should maintain DFS order", () => {
    const { tree } = makeTree();
    const flat = treeToFlatList(tree);
    const titles = flat.map((n) => n.title);
    expect(titles).toEqual([
      "Chapter 1",
      "Section 1.1",
      "Section 1.2",
      "Chapter 2",
      "Section 2.1",
    ]);
  });
});

describe("extractJson", () => {
  it("should parse raw JSON", () => {
    expect(extractJson('{"key": "value"}')).toEqual({ key: "value" });
  });

  it("should parse code block", () => {
    const text = 'Here is the result:\n```json\n{"a": 1}\n```';
    expect(extractJson(text)).toEqual({ a: 1 });
  });

  it("should handle trailing comma", () => {
    const text = '```json\n{"a": 1, "b": 2,}\n```';
    expect(extractJson(text)).toEqual({ a: 1, b: 2 });
  });

  it("should extract embedded JSON", () => {
    const text = 'The answer is {"x": [1,2,3]} ok?';
    expect(extractJson(text)).toEqual({ x: [1, 2, 3] });
  });

  it("should parse list", () => {
    expect(extractJson("[1, 2, 3]")).toEqual([1, 2, 3]);
  });

  it("should throw for invalid input", () => {
    expect(() => extractJson("no json here at all")).toThrow(
      "Could not extract JSON",
    );
  });
});

describe("printTree", () => {
  it("should print without error", () => {
    const { tree } = makeTree();
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    printTree(tree);
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("[0001]");
    expect(output).toContain("Chapter 1");
    spy.mockRestore();
  });
});
