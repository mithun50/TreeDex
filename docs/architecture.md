---
layout: default
title: Architecture
nav_order: 2
---

# Architecture

## System Overview

TreeDex has six core modules, each implemented identically in Python and TypeScript:

```
┌─────────────────────────────────────────────────────┐
│                  Document Loaders                    │
│  PDFLoader · TextLoader · HTMLLoader · DOCXLoader    │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │      PDF Parser         │
          │  extract_pages()        │
          │  extract_toc()          │
          │  [H1][H2][H3] markers   │
          │  group_pages()          │
          └────────┬───────┬────────┘
                   │       │
         ┌─────────▼─┐   ┌▼──────────────────────┐
         │ ToC found  │   │  No ToC → LLM path    │
         │ Zero LLM   │   │  Heading-guided        │
         │ calls      │   │  Capped continuation   │
         └─────┬──────┘   └─────────┬──────────────┘
               │                    │
          ┌────▼────────────────────▼─────┐
          │        Tree Builder           │
          │  toc_to_sections()            │
          │  repair_orphans()             │
          │  list_to_tree()               │
          │  assign_page_ranges()         │
          │  assign_node_ids()            │
          │  embed_text_in_tree()         │
          └──────────────┬────────────────┘
                         │
          ┌──────────────▼────────────────┐
          │         TreeDex Core          │
          │  .query()  .save()  .load()   │
          └──────────────┬────────────────┘
                         │
          ┌──────────────▼────────────────┐
          │         QueryResult           │
          │  .context  .node_ids          │
          │  .page_ranges  .reasoning     │
          │  .answer (agentic mode)       │
          └───────────────────────────────┘
```

## Module Map

| Module | Python | TypeScript | LOC | Purpose |
|--------|--------|------------|-----|---------|
| Core | `treedex/core.py` | `src/core.ts` | 303 / 398 | Main TreeDex class |
| LLM Backends | `treedex/llm_backends.py` | `src/llm-backends.ts` | 700 / 738 | 18+ provider integrations |
| Loaders | `treedex/loaders.py` | `src/loaders.ts` | 153 / 190 | Format-specific document loading |
| PDF Parser | `treedex/pdf_parser.py` | `src/pdf-parser.ts` | 133 / 154 | PDF extraction, ToC, headings |
| Prompts | `treedex/prompts.py` | `src/prompts.ts` | 91 / 105 | LLM prompt templates |
| Tree Builder | `treedex/tree_builder.py` | `src/tree-builder.ts` | 120 / 156 | Flat → hierarchical tree |
| Tree Utils | `treedex/tree_utils.py` | `src/tree-utils.ts` | 152 / 188 | Traversal, serialization |
| Types | — | `src/types.ts` | — / 42 | TypeScript type definitions |

---

## Indexing Pipeline

### Step 1: Document Loading

```python
pages = auto_loader("doc.pdf", detect_headings=True)
# Returns: [{"page_num": 0, "text": "...", "token_count": 342}, ...]
```

Each loader returns a flat list of `Page` objects with pre-computed token counts. Non-PDF formats split text into synthetic pages by character count (default: 3,000 chars/page).

### Step 2: Smart Detection (PDF only)

**ToC Extraction:**
```python
toc = extract_toc("doc.pdf")
# Returns: [{"level": 1, "title": "Intro", "physical_index": 0}, ...] or None
```

Uses PDF bookmarks/outline metadata. If 3+ entries found, the tree is built directly — **no LLM needed**.

**Font-Size Heading Detection:**
1. Sample up to 50 pages, collect all font sizes weighted by character count
2. Most-used size = body text. Sizes > body + 0.5pt = headings
3. Top 3 heading sizes → `[H1]`, `[H2]`, `[H3]` (largest first)
4. Inject markers before heading lines in page text

### Step 3: Page Grouping

```python
groups = group_pages(pages, max_tokens=20000, overlap=1)
```

Pages are batched into token-budget groups. Each page is wrapped in XML tags:

```xml
<physical_index_0>Page 0 text here...</physical_index_0>
<physical_index_1>Page 1 text here...</physical_index_1>
```

Adjacent groups overlap by 1 page to catch sections spanning boundaries.

### Step 4: Structure Extraction

- **Group 1:** Full extraction prompt → LLM returns `[{structure, title, physical_index}, ...]`
- **Groups 2+:** Continuation prompt with **capped context** (top-level outline + last 30 sections)
- **Result:** Flat list of sections with hierarchical numbering (`"1"`, `"1.1"`, `"1.2.3"`)

### Step 5: Orphan Repair

```python
sections = repair_orphans(sections)
```

If `"2.3.1"` exists but `"2.3"` doesn't, a synthetic `"2.3"` node is inserted.

### Step 6: Tree Construction

```python
tree = list_to_tree(sections)       # Build hierarchy
assign_page_ranges(tree, len(pages)) # Set start/end indices
assign_node_ids(tree)                # DFS: "0001", "0002", ...
embed_text_in_tree(tree, pages)      # Populate node.text
```

---

## Query Pipeline

```python
result = index.query("What methods were used?")
```

1. **Strip tree** — Remove `node.text` from tree copy (minimize tokens)
2. **LLM selection** — Send stripped tree + question → LLM returns `{node_ids, reasoning}`
3. **Text lookup** — O(1) node map lookup for each selected node
4. **Optional answer** — If `agentic=True`, generate answer from retrieved context
5. **Return** — `QueryResult` with context, node IDs, page ranges, reasoning

---

## Data Types

### Page

```typescript
interface Page {
  page_num: number;       // 0-indexed
  text: string;           // Page content (may include [H1]/[H2]/[H3] markers)
  token_count: number;    // Pre-computed cl100k_base tokens
  images?: PageImage[];   // Optional extracted images
}
```

### TreeNode

```typescript
interface TreeNode {
  structure: string;       // "1", "1.1", "1.2.3"
  title: string;           // Section title
  physical_index: number;  // Page where section starts
  nodes: TreeNode[];       // Children
  start_index?: number;    // Page range start (assigned after tree build)
  end_index?: number;      // Page range end
  node_id?: string;        // "0001", "0002" (4-digit, DFS order)
  text?: string;           // Concatenated page text (assigned after tree build)
}
```

### IndexData (JSON format)

```typescript
interface IndexData {
  version: "1.0";
  framework: "TreeDex";
  tree: TreeNode[];    // Without text (stripped for storage)
  pages: Page[];       // Without images (descriptions already in text)
}
```

---

## Complexity

| Operation | Time | Space |
|-----------|------|-------|
| `extract_pages()` | O(pages) | O(pages × text) |
| `extract_toc()` | O(toc entries) | O(entries) |
| `group_pages()` | O(pages) | O(groups × text) |
| `list_to_tree()` | O(n) | O(n) |
| `repair_orphans()` | O(n × depth) | O(inserts) |
| `assign_page_ranges()` | O(n) | O(1) in-place |
| `embed_text_in_tree()` | O(n × pages/node) | O(text) |
| `query()` | O(1 LLM + n) | O(context) |
| `save()` / `load()` | O(n + pages) | O(JSON) |

Where n = tree nodes (typically 10-500).

Next: [API Reference →](api.md)
