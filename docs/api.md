---
layout: default
title: API Reference
nav_order: 4
---

# API Reference

## TreeDex

The main class for building and querying document indices.

### Constructor

```python
# Python
TreeDex(tree: list[dict], pages: list[dict], llm=None)
```

```typescript
// TypeScript
new TreeDex(tree: TreeNode[], pages: Page[], llm: BaseLLM | null = null)
```

You typically don't call the constructor directly — use the factory methods below.

---

### Factory Methods

#### `from_file` / `fromFile`

Build an index from a document file. This is the primary entry point.

```python
# Python
index = TreeDex.from_file(
    path: str,
    llm: BaseLLM,
    loader=None,             # Custom loader (auto-detect if None)
    max_tokens: int = 20000, # Token budget per page group
    overlap: int = 1,        # Page overlap between groups
    verbose: bool = True,    # Print progress
    extract_images: bool = False  # Extract images for vision LLM
)
```

```typescript
// TypeScript
const index = await TreeDex.fromFile(path, llm, {
  loader?,          // Custom loader
  maxTokens?: 20000,
  overlap?: 1,
  verbose?: true,
  extractImages?: false,
});
```

**Pipeline:**
1. Check for PDF ToC → if found, build tree directly (0 LLM calls)
2. Load pages with heading detection (PDFs without ToC)
3. Group pages by token budget
4. LLM extracts structure per group
5. Repair orphans → build tree

#### `from_pages` / `fromPages`

Build from pre-extracted pages (skip document loading).

```python
index = TreeDex.from_pages(pages, llm, max_tokens=20000, overlap=1, verbose=True)
```

```typescript
const index = await TreeDex.fromPages(pages, llm, { maxTokens, overlap, verbose });
```

#### `from_tree` / `fromTree`

Create from an existing tree and pages (no processing).

```python
index = TreeDex.from_tree(tree, pages, llm)
```

```typescript
const index = TreeDex.fromTree(tree, pages, llm);
```

#### `load`

Load a previously saved index from JSON.

```python
index = TreeDex.load("index.json", llm=llm)
```

```typescript
const index = await TreeDex.load("index.json", llm);
```

---

### Instance Methods

#### `query`

Retrieve relevant sections for a question.

```python
result = index.query(
    question: str,
    llm=None,            # Override LLM (uses constructor LLM if None)
    agentic: bool = False # Generate an answer from context
) -> QueryResult
```

```typescript
const result = await index.query(question, {
  llm?,       // Override LLM
  agentic?,   // Generate answer
});
// Or shorthand: await index.query(question, llm)
```

#### `query_all` / `queryAll` _(static)_

Query **multiple indexes simultaneously** and merge results into a single
`MultiQueryResult`. All indexes are queried in parallel (Node.js) or
sequentially (Python). Results are combined with clear `[Document N]`
separators so downstream LLMs or users can distinguish sources.

```python
multi = TreeDex.query_all(
    indexes: list[TreeDex],
    question: str,
    llm=None,                  # Shared LLM override (falls back to each index's LLM)
    agentic: bool = False,     # Generate one answer over the combined context
    labels: list[str] = None   # Human-readable names (default: "Document 1", "Document 2", …)
) -> MultiQueryResult
```

```typescript
const multi = await TreeDex.queryAll(indexes, question, {
  llm?,      // Shared LLM override
  agentic?,  // Generate one answer over combined context
  labels?,   // Human-readable names per index
});
```

**Example:**

```python
multi = TreeDex.query_all(
    [index_a, index_b, index_c],
    "What are the safety guidelines?",
    llm=llm,
    labels=["Manual A", "Manual B", "Manual C"],
    agentic=True,
)
print(multi.combined_context)   # merged text with [Manual A] / [Manual B] headers
print(multi.answer)             # single LLM-generated answer over all sources
print(multi.results[0].pages_str)  # pages matched in Manual A
```

```typescript
const multi = await TreeDex.queryAll(
  [indexA, indexB, indexC],
  "What are the safety guidelines?",
  { llm, labels: ["Manual A", "Manual B", "Manual C"], agentic: true },
);
console.log(multi.combinedContext);
console.log(multi.answer);
console.log(multi.results[0].pagesStr);
```

#### `save`

Export the index to a JSON file.

```python
path = index.save("index.json")  # Returns the path
```

```typescript
const path = await index.save("index.json");
```

The saved JSON contains the tree structure (without embedded text) and all pages. Text is re-embedded on `load()`.

#### `show_tree` / `showTree`

Pretty-print the tree structure.

```python
index.show_tree()
```

Output:
```
[0001] 1: Introduction (pages 1-4)
  [0002] 1.1: Background (pages 1-2)
  [0003] 1.2: Motivation (pages 3-4)
[0004] 2: Methods (pages 5-12)
  ...
```

#### `stats`

Return index statistics.

```python
stats = index.stats()
# {
#   "total_pages": 21,
#   "total_tokens": 11710,
#   "total_nodes": 41,
#   "leaf_nodes": 32,
#   "root_sections": 10
# }
```

#### `find_large_sections` / `findLargeSections`

Find sections that exceed size thresholds.

```python
large = index.find_large_sections(max_pages=10, max_tokens=20000)
```

```typescript
const large = index.findLargeSections({ maxPages: 10, maxTokens: 20000 });
```

---

## QueryResult

Returned by `index.query()`.

| Property | Python | Node.js | Type | Description |
|----------|--------|---------|------|-------------|
| Context | `.context` | `.context` | `str` | Concatenated text from selected nodes |
| Node IDs | `.node_ids` | `.nodeIds` | `list[str]` | IDs of selected tree nodes |
| Page ranges | `.page_ranges` | `.pageRanges` | `list[tuple]` | `[(start, end), ...]` (0-indexed) |
| Pages string | `.pages_str` | `.pagesStr` | `str` | Human-readable: `"pages 5-8, 12-15"` |
| Reasoning | `.reasoning` | `.reasoning` | `str` | LLM's explanation |
| Answer | `.answer` | `.answer` | `str` | Generated answer (agentic mode only) |

---

## MultiQueryResult

Returned by `TreeDex.query_all()` / `TreeDex.queryAll()`.

| Property | Python | Node.js | Type | Description |
|----------|--------|---------|------|-------------|
| Per-index results | `.results` | `.results` | `list[QueryResult]` | One `QueryResult` per index, in input order |
| Labels | `.labels` | `.labels` | `list[str]` | Human-readable name for each index |
| Combined context | `.combined_context` | `.combinedContext` | `str` | All contexts merged with `[Label]` headers and `---` separators |
| Answer | `.answer` | `.answer` | `str` | Single LLM-generated answer over all sources (agentic mode only) |

**Combined context format:**

```
[Manual A]
[Section: Safety Guidelines]
Content from Manual A...

---

[Manual B]
[Section: Hazard Procedures]
Content from Manual B...
```

---

## PDF Parser Functions

### `extract_toc` / `extractToc`

Extract table of contents from PDF bookmarks.

```python
toc = extract_toc("doc.pdf")
# Returns: [{"level": 1, "title": "Intro", "physical_index": 0}, ...] or None
```

```typescript
const toc = await extractToc("doc.pdf");
// Returns: TocEntry[] | null
```

Returns `None`/`null` if the PDF has fewer than 3 ToC entries.

### `extract_pages` / `extractPages`

Extract text from each page of a PDF.

```python
pages = extract_pages(
    "doc.pdf",
    extract_images=False,    # Extract images as base64
    detect_headings=False    # Inject [H1]/[H2]/[H3] markers
)
```

```typescript
const pages = await extractPages("doc.pdf", {
  extractImages: false,
  detectHeadings: false,
});
```

### `group_pages` / `groupPages`

Split pages into token-budget groups.

```python
groups = group_pages(pages, max_tokens=20000, overlap=1)
# Returns: list of tagged text strings
```

### `count_tokens` / `countTokens`

Count tokens using cl100k_base encoding.

```python
n = count_tokens("Hello world")  # → 2
```

---

## Tree Builder Functions

### `toc_to_sections` / `tocToSections`

Convert ToC entries to numbered sections.

```python
sections = toc_to_sections([
    {"level": 1, "title": "Intro", "physical_index": 0},
    {"level": 2, "title": "Background", "physical_index": 2},
])
# → [{"structure": "1", "title": "Intro", ...},
#    {"structure": "1.1", "title": "Background", ...}]
```

### `repair_orphans` / `repairOrphans`

Insert synthetic parent nodes for orphaned subsections.

```python
repaired = repair_orphans([
    {"structure": "1", "title": "Intro", "physical_index": 0},
    {"structure": "2.3.1", "title": "Deep", "physical_index": 5},
])
# Inserts "2" and "2.3" as synthetic parents
```

### `list_to_tree` / `listToTree`

Convert flat sections to a hierarchical tree.

```python
tree = list_to_tree(sections)
```

### `assign_page_ranges` / `assignPageRanges`

Set `start_index` and `end_index` on each node.

```python
assign_page_ranges(tree, total_pages=21)
```

### `assign_node_ids` / `assignNodeIds`

DFS traversal, assigns sequential IDs (`"0001"`, `"0002"`, ...).

```python
assign_node_ids(tree)
```

### `embed_text_in_tree` / `embedTextInTree`

Populate each node's `text` field by concatenating pages in its range.

```python
embed_text_in_tree(tree, pages)
```

### `find_large_nodes` / `findLargeNodes`

Return nodes exceeding page or token thresholds.

```python
large = find_large_nodes(tree, max_pages=10, max_tokens=20000, pages=pages)
```

---

## Tree Utility Functions

### `create_node_mapping` / `createNodeMapping`

Build a flat `{node_id: node}` map for O(1) lookups.

```python
node_map = create_node_mapping(tree)
node = node_map["0005"]
```

### `strip_text_from_tree` / `stripTextFromTree`

Deep copy the tree with all `text` fields removed (for LLM prompts).

```python
stripped = strip_text_from_tree(tree)
```

### `collect_node_texts` / `collectNodeTexts`

Concatenate text from specific nodes.

```python
text = collect_node_texts(["0005", "0008"], node_map)
```

### `extract_json` / `extractJson`

Robust JSON extraction from LLM output. Handles:
- Raw JSON
- Markdown code blocks
- Trailing commas
- Text before/after JSON

```python
data = extract_json('Some text ```json\n[{"a": 1}]\n``` more text')
# → [{"a": 1}]
```

### `count_nodes` / `countNodes`

```python
n = count_nodes(tree)  # Total nodes including children
```

### `get_leaf_nodes` / `getLeafNodes`

```python
leaves = get_leaf_nodes(tree)  # Nodes with no children
```

### `print_tree` / `printTree`

```python
print_tree(tree)
# [0001] 1: Introduction (pages 1-4)
#   [0002] 1.1: Background (pages 1-2)
```

---

## Document Loaders

### auto_loader / autoLoader

```python
pages = auto_loader("doc.pdf", extract_images=False, detect_headings=False)
```

```typescript
const pages = await autoLoader("doc.pdf", { extractImages, detectHeadings });
```

Auto-detects format by extension: `.pdf`, `.txt`, `.md`, `.html`, `.htm`, `.docx`.

### PDFLoader

```python
loader = PDFLoader(extract_images=False, detect_headings=False)
pages = loader.load("doc.pdf")
```

### TextLoader

```python
loader = TextLoader(chars_per_page=3000)
pages = loader.load("doc.txt")
```

### HTMLLoader

```python
loader = HTMLLoader(chars_per_page=3000)
pages = loader.load("doc.html")
```

### DOCXLoader

```python
loader = DOCXLoader(chars_per_page=3000)
pages = loader.load("doc.docx")
```

Next: [LLM Backends →](llm-backends.md)
