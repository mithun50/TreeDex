export interface TreeNode {
  nodeId: string;
  structure: string;
  title: string;
  startIndex: number;
  endIndex: number;
  children: TreeNode[];
}

// Flattened from examples/my_index.json — EM Waves chapter (14 nodes)
export const TREE_ROOT: TreeNode = {
  nodeId: "0001",
  structure: "1",
  title: "Chapter Eight: EM WAVES",
  startIndex: 0,
  endIndex: 13,
  children: [
    {
      nodeId: "0002",
      structure: "1.1",
      title: "INTRODUCTION",
      startIndex: 0,
      endIndex: 0,
      children: [],
    },
    {
      nodeId: "0003",
      structure: "1.2",
      title: "DISPLACEMENT CURRENT",
      startIndex: 1,
      endIndex: 3,
      children: [],
    },
    {
      nodeId: "0004",
      structure: "1.3",
      title: "ELECTROMAGNETIC WAVES",
      startIndex: 4,
      endIndex: 6,
      children: [
        {
          nodeId: "0005",
          structure: "1.3.1",
          title: "Sources of EM waves",
          startIndex: 4,
          endIndex: 4,
          children: [],
        },
        {
          nodeId: "0006",
          structure: "1.3.2",
          title: "Nature of EM waves",
          startIndex: 5,
          endIndex: 6,
          children: [],
        },
      ],
    },
    {
      nodeId: "0007",
      structure: "1.4",
      title: "EM SPECTRUM",
      startIndex: 7,
      endIndex: 13,
      children: [
        {
          nodeId: "0008",
          structure: "1.4.1",
          title: "Radio waves",
          startIndex: 8,
          endIndex: 7,
          children: [],
        },
        {
          nodeId: "0009",
          structure: "1.4.2",
          title: "Microwaves",
          startIndex: 8,
          endIndex: 8,
          children: [],
        },
        {
          nodeId: "0010",
          structure: "1.4.3",
          title: "Infrared waves",
          startIndex: 9,
          endIndex: 8,
          children: [],
        },
        {
          nodeId: "0011",
          structure: "1.4.4",
          title: "Visible rays",
          startIndex: 9,
          endIndex: 8,
          children: [],
        },
        {
          nodeId: "0012",
          structure: "1.4.5",
          title: "Ultraviolet rays",
          startIndex: 9,
          endIndex: 9,
          children: [],
        },
        {
          nodeId: "0013",
          structure: "1.4.6",
          title: "X-rays",
          startIndex: 10,
          endIndex: 9,
          children: [],
        },
        {
          nodeId: "0014",
          structure: "1.4.7",
          title: "Gamma rays",
          startIndex: 10,
          endIndex: 13,
          children: [],
        },
      ],
    },
  ],
};

// Flat list of all 14 nodes for easy iteration
export function flattenTree(node: TreeNode): TreeNode[] {
  return [node, ...node.children.flatMap(flattenTree)];
}

export const ALL_NODES = flattenTree(TREE_ROOT);

// Provider names for the closing orbit
export const PROVIDERS = [
  "OpenAI",
  "Anthropic",
  "Google",
  "Mistral",
  "Cohere",
  "Groq",
  "Ollama",
  "DeepSeek",
  "HuggingFace",
  "Azure",
  "AWS Bedrock",
  "Together",
  "Fireworks",
  "Replicate",
];
