/** Shared type definitions for TreeDex. */

export interface PageImage {
  data: string;           // base64-encoded image
  mime_type: string;      // "image/png", "image/jpeg"
  alt_text?: string;      // from HTML/DOCX or vision LLM
  index_on_page?: number; // position within page
}

export interface Page {
  page_num: number;
  text: string;
  token_count: number;
  images?: PageImage[];
}

export interface TreeNode {
  structure: string;
  title: string;
  physical_index: number;
  nodes: TreeNode[];
  start_index?: number;
  end_index?: number;
  node_id?: string;
  text?: string;
  [key: string]: unknown;
}

export interface IndexData {
  version: string;
  framework: string;
  tree: TreeNode[];
  pages: Page[];
}

export interface Stats {
  total_pages: number;
  total_tokens: number;
  total_nodes: number;
  leaf_nodes: number;
  root_sections: number;
}
