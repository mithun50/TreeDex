# TreeDex — Comprehensive Documentation

> Tree-based, vectorless document RAG framework.
> Available for Python (3.10+) and Node.js (18+) with identical APIs and cross-compatible index format.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Pipeline Deep Dive](#pipeline-deep-dive)
- [Smart Hierarchy Detection](#smart-hierarchy-detection)
- [API Reference](#api-reference)
- [LLM Backend System](#llm-backend-system)
- [Token Management Strategy](#token-management-strategy)
- [Benchmarks](#benchmarks)
- [Case Studies](#case-studies)
- [Cross-Language Parity](#cross-language-parity)
- [Error Handling](#error-handling)
- [Configuration & Tuning](#configuration--tuning)
- [Limitations & Edge Cases](#limitations--edge-cases)

---

## Architecture Overview

TreeDex has six core modules, each implemented identically in Python and TypeScript:

```
┌─────────────────────────────────────────────────────┐
│                  Document Loaders                    │
│  PDFLoader · TextLoader · HTMLLoader · DOCXLoader    │
│  auto_loader() — auto-detect format                  │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │     PDF Parser          │
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
          │  .stats()  .show_tree()       │
          └──────────────┬────────────────┘
                         │
          ┌──────────────▼────────────────┐
          │         QueryResult           │
          │  .context  .node_ids          │
          │  .page_ranges  .reasoning     │
          │  .answer (agentic mode)       │
          └───────────────────────────────┘
```

### Module Map

| Module | Python | TypeScript | LOC | Purpose |
|--------|--------|------------|-----|---------|
| Core | `treedex/core.py` | `src/core.ts` | 303 / 398 | Main `TreeDex` class, indexing and querying |
| LLM Backends | `treedex/llm_backends.py` | `src/llm-backends.ts` | 700 / 738 | 18+ provider integrations |
| Loaders | `treedex/loaders.py` | `src/loaders.ts` | 153 / 190 | Format-specific document loading |
| PDF Parser | `treedex/pdf_parser.py` | `src/pdf-parser.ts` | 133 / 154 | PDF extraction, ToC, heading detection |
| Prompts | `treedex/prompts.py` | `src/prompts.ts` | 91 / 105 | LLM prompt templates |
| Tree Builder | `treedex/tree_builder.py` | `src/tree-builder.ts` | 120 / 156 | Flat sections → hierarchical tree |
| Tree Utils | `treedex/tree_utils.py` | `src/tree-utils.ts` | 152 / 188 | Traversal, serialization, JSON extraction |
| Types | — | `src/types.ts` | — / 42 | TypeScript type definitions |

---

## Pipeline Deep Dive

### 1. Document Loading

TreeDex auto-detects format by extension and delegates to the appropriate loader:

| Format | Library (Python) | Library (Node.js) | Images | Headings |
|--------|-----------------|-------------------|--------|----------|
| PDF | PyMuPDF (fitz) | pdfjs-dist | Base64 extraction | Font-size analysis |
| TXT/MD | stdlib | Node.js fs | — | — |
| HTML | HTMLParser (stdlib) | htmlparser2 / regex fallback | Alt text extraction | — |
| DOCX | python-docx | mammoth | Inline images | — |

Each loader returns a list of `Page` objects:

```json
{
  "page_num": 0,
  "text": "Chapter 1: Introduction...",
  "token_count": 342,
  "images": [{"data": "base64...", "mime_type": "image/png"}]
}
```

**Non-PDF formats** split text into synthetic pages by character count (default 3,000 chars/page).

### 2. PDF ToC Extraction

Before any LLM calls, TreeDex checks for PDF bookmarks:

```python
# Python
toc = extract_toc("document.pdf")
# Returns: [{"level": 1, "title": "Introduction", "physical_index": 0}, ...]
# Or None if < 3 entries
```

```typescript
// TypeScript
const toc = await extractToc("document.pdf");
```

**How it works:**
- **Python:** Uses `fitz.open(path).get_toc()` which reads the PDF outline/bookmarks metadata
- **TypeScript:** Uses `pdfjs.getDocument().getOutline()` and recursively walks the outline tree, resolving page destinations

If a usable ToC is found (3+ entries), the entire LLM extraction step is **skipped** — the tree is built directly from ToC entries via `toc_to_sections()`.

### 3. Font-Size Heading Detection

When no ToC is available, TreeDex analyzes font sizes to inject hierarchy markers:

**Step 1: Analyze** — Sample up to 50 pages, collect all font sizes weighted by character count.

**Step 2: Classify** — The most-used font size = body text. All sizes > body + 0.5pt = headings. Top 3 heading sizes → H1, H2, H3 (largest first).

**Step 3: Annotate** — Each line gets a marker based on its font size:

```
Without markers:          With markers:
─────────────────         ─────────────────
3 System Architecture     [H2] 3 System Architecture
TreeDex consists of...    TreeDex consists of...
3.1 Architecture          [H3] 3.1 Architecture overview
overview                  Figure 1 illustrates...
Figure 1 illustrates...
```

**Overhead:** Only +2.7% more tokens (314 extra tokens on a 12k-token document), but dramatically improves hierarchy accuracy.

### 4. Page Grouping

Documents are split into token-budgeted groups for the LLM:

```
Pages: [P0, P1, P2, P3, P4, P5, P6, P7, P8, P9]
                                                    max_tokens = 4000
Group 1: [P0, P1, P2, P3, P4, P5, P6]  ← 3,868 tokens
           overlap ↕
Group 2: [P6, P7, P8, P9, P10, P11, P12]  ← 3,926 tokens
           overlap ↕
Group 3: [P12, P13, P14, P15, P16, P17]  ← 3,631 tokens
```

Each page is wrapped in XML tags: `<physical_index_N>text</physical_index_N>` so the LLM knows which page each section starts on.

### 5. Structure Extraction

**Group 1** gets the full extraction prompt. The LLM returns:

```json
[
  {"structure": "1", "title": "Introduction", "physical_index": 1},
  {"structure": "1.1", "title": "Background", "physical_index": 1},
  {"structure": "1.2", "title": "Methods", "physical_index": 3}
]
```

**Groups 2+** get a continuation prompt with **capped context**:

| Document Size | Old Context (all sections) | New Context (capped) | Savings |
|---------------|---------------------------:|---------------------:|--------:|
| 100 pages | 9,750 tokens | 4,800 tokens | 50.8% |
| 300 pages | 117,200 tokens | 19,200 tokens | 83.6% |
| 500 pages | 317,200 tokens | 31,200 tokens | **90.2%** |

The capped context includes:
- All top-level sections (chapters) — to maintain overall structure awareness
- Last 30 detailed sections — to continue numbering correctly
- Total section count and last structure ID

### 6. Orphan Repair

After extraction, `repair_orphans()` fixes broken hierarchy:

```
Before repair:                After repair:
─────────────                 ─────────────
1    — Introduction           1    — Introduction
1.1  — Background             1.1  — Background
2.3.1 — Deep orphan           2    — Section 2      ← synthetic
                              2.3  — Section 2.3    ← synthetic
                              2.3.1 — Deep orphan
```

### 7. Tree Construction

The flat section list becomes a hierarchical tree:

1. `list_to_tree()` — Parent lookup by structure prefix ("1.2.3" → parent "1.2")
2. `assign_page_ranges()` — Each node gets start/end page indices
3. `assign_node_ids()` — DFS assigns "0001", "0002", etc.
4. `embed_text_in_tree()` — Each node gets concatenated page text for its range

### 8. Querying

```python
result = index.query("What methods were used?")
```

**Step 1:** Strip text from tree (keep only structure/title/page_ranges/node_ids) to minimize tokens.

**Step 2:** Send stripped tree + question to LLM. LLM returns `{node_ids: [...], reasoning: "..."}`.

**Step 3:** Look up full text for selected nodes via the node map (O(1) per node).

**Step 4 (agentic):** Optionally generate an answer from the retrieved context.

---

## Smart Hierarchy Detection

### Strategy Priority

```
1. PDF has bookmarks/outline?
   YES → extract_toc() → toc_to_sections() → build tree (0 LLM calls)
   NO  ↓

2. PDF file?
   YES → detect_headings=True → font-size analysis → [H1][H2][H3] markers
   NO  → plain text extraction

3. LLM extraction with heading-guided prompts
   → repair_orphans() → build tree
```

### How Font-Size Detection Works

```python
# Step 1: Collect font sizes from first 50 pages
size_chars = Counter()
for page in doc[:50]:
    for block in page.get_text("dict")["blocks"]:
        for line in block["lines"]:
            for span in line["spans"]:
                size_chars[round(span["size"], 1)] += len(span["text"])

# Step 2: Body = most common size
body_size = size_chars.most_common(1)[0][0]  # e.g., 10.0

# Step 3: Headings = larger sizes, sorted descending
# e.g., 17.2 → H1, 12.0 → H2, 11.0 → H3

# Step 4: Annotate lines
# "[H2] 3 System Architecture"
# "TreeDex consists of five core modules..."
```

### How ToC Numbering Works

```
PDF Outline:               → Structure Numbering:
─────────────              ─────────────────────
Level 1: Introduction      → "1"
  Level 2: Background      → "1.1"
  Level 2: Motivation      → "1.2"
Level 1: Methods           → "2"
  Level 2: Data            → "2.1"
    Level 3: Surveys       → "2.1.1"
```

Counters are maintained per level. When a new Level 1 appears, all deeper counters reset.

---

## API Reference

### TreeDex

| Method | Python | Node.js | Description |
|--------|--------|---------|-------------|
| Build from file | `TreeDex.from_file(path, llm, **opts)` | `await TreeDex.fromFile(path, llm, opts?)` | Full pipeline: load → detect → extract → build |
| Build from pages | `TreeDex.from_pages(pages, llm, **opts)` | `await TreeDex.fromPages(pages, llm, opts?)` | From pre-extracted pages |
| Build from tree | `TreeDex.from_tree(tree, pages, llm)` | `TreeDex.fromTree(tree, pages, llm)` | From existing tree (no LLM) |
| Query | `index.query(q, llm=, agentic=)` | `await index.query(q, {llm?, agentic?})` | Retrieve relevant sections |
| **Multi-index query** | **`TreeDex.query_all(indexes, q, ...)`** | **`await TreeDex.queryAll(indexes, q, ...)`** | **Query multiple indexes simultaneously** |
| Save | `index.save(path)` | `await index.save(path)` | Export to JSON |
| Load | `TreeDex.load(path, llm)` | `await TreeDex.load(path, llm)` | Import from JSON |
| Show tree | `index.show_tree()` | `index.showTree()` | Pretty-print |
| Stats | `index.stats()` | `index.stats()` | Return `{total_pages, total_tokens, ...}` |
| Find large | `index.find_large_sections(**opts)` | `index.findLargeSections(opts?)` | Nodes exceeding thresholds |

#### `query_all` / `queryAll` Options

Query multiple TreeDex indexes simultaneously. Indexes are queried in parallel
(Node.js) or sequentially (Python), then results are merged into a single
`MultiQueryResult` with `[Label]` separators between sources.

| Parameter | Python | Node.js | Default | Description |
|-----------|--------|---------|---------|-------------|
| indexes | `list[TreeDex]` | `TreeDex[]` | required | List of indexes to query |
| question | `str` | `string` | required | The user's question |
| llm | `llm=` | `{ llm? }` | `None` | Shared LLM override; falls back to each index's own LLM |
| agentic | `agentic=` | `{ agentic? }` | `False` | Generate a single answer over the combined context |
| labels | `labels=` | `{ labels? }` | `["Document 1", ...]` | Human-readable name per index |

```python
multi = TreeDex.query_all(
    [index_a, index_b, index_c],
    "What are the safety guidelines?",
    labels=["Manual A", "Manual B", "Manual C"],
    agentic=True,
)
print(multi.combined_context)   # merged context with [Manual A]/[Manual B] headers
print(multi.answer)             # single answer over all sources
print(multi.results[0].pages_str)  # pages from Manual A
```

```typescript
const multi = await TreeDex.queryAll(
  [indexA, indexB, indexC],
  "What are the safety guidelines?",
  { labels: ["Manual A", "Manual B", "Manual C"], agentic: true },
);
console.log(multi.combinedContext);
console.log(multi.answer);
```

#### `from_file` Options

| Parameter | Python | Node.js | Default | Description |
|-----------|--------|---------|---------|-------------|
| path | `str` | `string` | required | Document file path |
| llm | `BaseLLM` | `BaseLLM` | required | LLM backend instance |
| loader | `Loader` | `{load()}` | `None`/`undefined` | Custom loader (auto-detect if omitted) |
| max_tokens | `int` | `number` | 20000 | Token budget per page group |
| overlap | `int` | `number` | 1 | Page overlap between groups |
| verbose | `bool` | `boolean` | `True`/`true` | Print progress |
| extract_images | `bool` | `boolean` | `False`/`false` | Extract images from PDFs |

### QueryResult

| Property | Python | Node.js | Type | Description |
|----------|--------|---------|------|-------------|
| Context | `.context` | `.context` | `str` | Concatenated text from selected nodes |
| Node IDs | `.node_ids` | `.nodeIds` | `list[str]` | IDs of selected tree nodes |
| Page ranges | `.page_ranges` | `.pageRanges` | `list[tuple]` | `[(start, end), ...]` |
| Pages string | `.pages_str` | `.pagesStr` | `str` | `"pages 5-8, 12-15"` |
| Reasoning | `.reasoning` | `.reasoning` | `str` | LLM's selection explanation |
| Answer | `.answer` | `.answer` | `str` | Generated answer (agentic mode only) |

### MultiQueryResult

Returned by `TreeDex.query_all()` / `TreeDex.queryAll()`.

| Property | Python | Node.js | Type | Description |
|----------|--------|---------|------|-------------|
| Per-index results | `.results` | `.results` | `list[QueryResult]` | One result per index, in input order |
| Labels | `.labels` | `.labels` | `list[str]` | Human-readable name for each index |
| Combined context | `.combined_context` | `.combinedContext` | `str` | All contexts merged with `[Label]` headers and `---` separators |
| Answer | `.answer` | `.answer` | `str` | Single answer over all sources (agentic only) |

### Hierarchy Utilities

| Function | Python | Node.js | Description |
|----------|--------|---------|-------------|
| Extract PDF ToC | `extract_toc(path)` | `await extractToc(path)` | Returns `[{level, title, physical_index}]` or `None`/`null` |
| ToC → sections | `toc_to_sections(toc)` | `tocToSections(toc)` | Convert ToC entries to numbered sections |
| Repair orphans | `repair_orphans(sections)` | `repairOrphans(sections)` | Insert synthetic parents for orphaned subsections |
| List to tree | `list_to_tree(sections)` | `listToTree(sections)` | Flat sections → hierarchical tree |
| Extract JSON | `extract_json(text)` | `extractJson(text)` | Robust JSON extraction from LLM output |

---

## LLM Backend System

### Architecture

```
BaseLLM (abstract)
├── SDK-based (lazy import)
│   ├── GeminiLLM ─────── @google/generative-ai
│   ├── OpenAILLM ─────── openai
│   ├── ClaudeLLM ─────── @anthropic-ai/sdk
│   ├── MistralLLM ────── @mistralai/mistralai
│   └── CohereLLM ─────── cohere-ai
│
├── OpenAI-compatible (zero deps, fetch/urllib only)
│   ├── GroqLLM ─────────── api.groq.com
│   ├── TogetherLLM ─────── api.together.xyz
│   ├── FireworksLLM ────── api.fireworks.ai
│   ├── OpenRouterLLM ───── openrouter.ai
│   ├── DeepSeekLLM ─────── api.deepseek.com
│   ├── CerebrasLLM ─────── api.cerebras.ai
│   └── SambanovaLLM ────── api.sambanova.ai
│
├── Fetch-based (zero deps)
│   ├── HuggingFaceLLM ──── huggingface.co
│   └── OllamaLLM ──────── localhost:11434
│
├── Universal
│   ├── OpenAICompatibleLLM ── any URL + key
│   ├── LiteLLM ───────────── litellm (Python only)
│   └── FunctionLLM ────────── wrap any callable
│
└── BaseLLM ── subclass to build your own
```

### Vision Support

Three backends support image description for the `extract_images` feature:

| Backend | Method | Image Format |
|---------|--------|-------------|
| GeminiLLM | `generate_content()` with inline_data | Base64 PNG/JPEG |
| OpenAILLM | Chat completion with image_url | Base64 data URI |
| ClaudeLLM | Messages API with image source | Base64 with media_type |

### Custom Backend

```python
# Python
class MyLLM(BaseLLM):
    def generate(self, prompt: str) -> str:
        return my_api.call(prompt)

# Or use FunctionLLM for quick wrapping:
llm = FunctionLLM(lambda prompt: my_api.call(prompt))
```

```typescript
// TypeScript
const llm = new FunctionLLM((prompt: string) => myApi.call(prompt));
```

---

## Token Management Strategy

### Encoding

TreeDex uses **cl100k_base** (GPT-3.5/4 standard) for all token counting:
- **Python:** `tiktoken.get_encoding("cl100k_base")`
- **Node.js:** `gpt-tokenizer` (encode function)

### Where Tokens Matter

| Stage | Token Concern | How TreeDex Handles It |
|-------|---------------|----------------------|
| Page extraction | Pre-compute per page | `page.token_count` field |
| Page grouping | Fit within LLM context | `group_pages(maxTokens=20000)` |
| Continuation context | Don't balloon the prompt | Capped: top-level + last 30 sections |
| Query (tree structure) | Keep tree JSON small | `strip_text_from_tree()` removes all node text |
| Query (retrieved context) | Return relevant text | Only selected nodes' text is concatenated |

### Configuring for Your Model

```python
# Small context model (8k)
index = TreeDex.from_file("doc.pdf", llm, max_tokens=6000)

# Large context model (128k)
index = TreeDex.from_file("doc.pdf", llm, max_tokens=100000)
```

Lower `max_tokens` = more groups = more LLM calls but works with smaller context windows.
Higher `max_tokens` = fewer groups = faster but needs larger context.

---

## Benchmarks

All benchmarks on `research-paper.pdf` (21 pages, 11,710 tokens, 41 ToC entries).
Node.js, measured with `performance.now()`.

### Core Operations

| Operation | Time | Notes |
|-----------|------|-------|
| ToC extraction | **30.9 ms** | Reads PDF outline metadata |
| Page extraction (no headings) | **298.9 ms** | Plain text via pdfjs-dist |
| Page extraction (with headings) | **423.5 ms** | +41.7% for font analysis |
| Heading token overhead | **+314 tokens** | +2.7% (12,024 vs 11,710) |

### Page Grouping Speed

| max_tokens | Groups | Avg tokens/group | Time |
|-----------|--------|-------------------|------|
| 4,000 | 4 | 3,434 | 0.6 ms |
| 8,000 | 2 | 6,279 | 0.1 ms |
| 20,000 | 1 | 11,958 | 0.07 ms |
| 128,000 | 1 | 11,958 | 0.05 ms |

### Tree Building Speed

| Sections | Build Time | Nodes | Roots |
|----------|-----------|-------|-------|
| 10 | 0.6 ms | 12 | 2 |
| 50 | 0.3 ms | 50 | 10 |
| 200 | 0.5 ms | 200 | 40 |
| 500 | 1.3 ms | 500 | 100 |

### Orphan Repair

| Orphan Count | Time | Sections Added |
|-------------|------|----------------|
| 5 | 0.2 ms | 10 synthetic parents |
| 20 | 0.5 ms | 40 synthetic parents |
| 50 | 1.5 ms | 100 synthetic parents |
| 100 | 3.0 ms | 200 synthetic parents |

### tocToSections Speed

| ToC Entries | Time/call | 1000 calls |
|------------|-----------|------------|
| 10 | 13 μs | 12.8 ms |
| 50 | 44 μs | 43.7 ms |
| 200 | 156 μs | 155.6 ms |

### Memory Usage (Full Pipeline)

| Metric | Value |
|--------|-------|
| Heap delta | +1.54 MB |
| RSS delta | +4.70 MB |
| External delta | +0.84 MB |

---

## Case Studies

### Case Study 1: Before vs After Hierarchy Fix

**Problem:** On a 21-page research paper, the old extraction would produce 41 root-level nodes with max depth 1 — every section treated as a top-level chapter.

**After v0.1.5 (ToC extraction):**

| Metric | Before (flat) | After (hierarchical) | Improvement |
|--------|:------------:|:-------------------:|:-----------:|
| Root nodes | 41 | 10 | **75.6% reduction** |
| Max depth | 1 | 3 | 3x deeper |
| Child nodes | 0 | 31 | Proper nesting |
| LLM calls | 1+ | 0 | **100% saved** |

**Tree output (after):**
```
[0001] 1: Introduction (pages 1-1)
  [0002] 1.1: Background (pages 1-1)
  [0003] 1.2: Limitations of vector-based RAG (pages 1-1)
  [0004] 1.3: Our contribution (pages 2-2)
[0005] 2: Related Work (pages 2-4)
  [0006] 2.1: Retrieval-augmented generation (pages 2-2)
  [0007] 2.2: Document chunking strategies (pages 3-3)
  ...
[0011] 3: System Architecture (pages 5-8)
  [0012] 3.1: Architecture overview (pages 5-5)
  ...7 subsections...
```

### Case Study 2: Heading Detection Impact

**Page 2 without headings (what the LLM used to see):**
```
1 Introduction  1.1 Background  Large Language Models (LLMs),
accessible primarily through web APIs...
```

**Page 2 with headings (what the LLM sees now):**
```
[H2] 1 Introduction
[H3] 1.1 Background
Large Language Models (LLMs), accessible primarily through web
APIs...
```

The `[H2]` and `[H3]` markers make the hierarchy unambiguous. The LLM prompt instructs:
- `[H1]` = top-level chapters (`"1"`, `"2"`)
- `[H2]` = sections (`"1.1"`, `"1.2"`)
- `[H3]` = subsections (`"1.1.1"`, `"1.1.2"`)

**Cost:** Only 314 extra tokens across the entire 21-page document (+2.7%).

### Case Study 3: Capped Continuation Context

For a 500-page document generating ~976 sections across ~56 page groups:

**Old approach (Group 50 of 56):**
- Sends all 900+ previously extracted sections as JSON
- Context: **317,200 tokens** — exceeds most model limits
- LLM truncates or hallucinates structure

**New approach (Group 50 of 56):**
- Sends: 15 top-level chapters + 30 most recent sections + metadata
- Context: **31,200 tokens** — fits comfortably
- LLM has structural overview + continuation point
- **90.2% token savings**

| Document Size | Old Context | Capped Context | Savings |
|:------------:|:-----------:|:-------------:|:-------:|
| 100 pages | 9,750 tok | 4,800 tok | 50.8% |
| 300 pages | 117,200 tok | 19,200 tok | 83.6% |
| 500 pages | 317,200 tok | 31,200 tok | **90.2%** |

### Case Study 4: Orphan Repair in Practice

**Scenario:** LLM outputs `2.3.1` without ever producing `2` or `2.3`:

```
Input (broken):              Output (repaired):
──────────────               ──────────────────
1    — Introduction          1    — Introduction
1.1  — Background            1.1  — Background
2.3.1 — Deep section         2    — Section 2      ← synthetic
3.1.2 — Another orphan       2.3  — Section 2.3    ← synthetic
4    — Conclusion            2.3.1 — Deep section
                             3    — Section 3      ← synthetic
                             3.1  — Section 3.1    ← synthetic
                             3.1.2 — Another orphan
                             4    — Conclusion
```

5 input sections → 9 after repair. The tree now has correct hierarchy instead of 3 orphaned root nodes.

### Case Study 5: TreeDex vs Vector DB RAG

| Dimension | TreeDex | Vector DB (Chroma/Pinecone) |
|-----------|---------|----------------------------|
| **Indexing** | LLM extracts structure (or PDF ToC) | Embedding model generates vectors |
| **Storage** | JSON file (human-readable) | Vector database (opaque) |
| **Retrieval** | LLM navigates tree | Cosine similarity search |
| **Structure** | Preserves chapters/sections/subsections | Flat chunks, no hierarchy |
| **Attribution** | Exact page ranges per node | Approximate chunk boundaries |
| **Infrastructure** | None (just JSON) | Database server required |
| **Dependencies** | 1 LLM API | 1 LLM API + 1 embedding API + 1 DB |
| **Debugging** | Inspect JSON tree directly | Query embedding space (impractical) |
| **Cost per query** | 1 LLM call (tree nav) + 1 optional (answer) | 1 embedding call + 1 LLM call |
| **Scales to 1M+ tokens** | Yes (page grouping + capped context) | Yes (vector DB handles scale) |
| **Best for** | Structured docs (papers, books, manuals) | Unstructured content (logs, chat, mixed) |

---

## Cross-Language Parity

TreeDex maintains identical behavior across Python and Node.js. The JSON index format is fully cross-compatible — build in Python, query from Node.js, or vice versa.

### Naming Conventions

| Concept | Python | Node.js |
|---------|--------|---------|
| Functions | `snake_case` | `camelCase` |
| Classes | `PascalCase` | `PascalCase` |
| JSON fields | `snake_case` | `snake_case` (shared format) |
| File names | `snake_case.py` | `kebab-case.ts` |

### Implementation Differences

| Feature | Python | TypeScript | Notes |
|---------|--------|------------|-------|
| PDF library | PyMuPDF (fitz) | pdfjs-dist | PyMuPDF is faster; pdfjs runs in browser |
| Token counting | tiktoken | gpt-tokenizer | Both use cl100k_base |
| Async | Synchronous | `async/await` | Python blocks; TS is non-blocking |
| LiteLLM | Supported | Not available | Python-only universal backend |
| Image extraction | Full base64 | Metadata only | pdfjs doesn't easily export encoded images |
| Heading detection | `page.get_text("dict")` | `getTextContent()` items | Both analyze font sizes |

### Index Format (Shared)

```json
{
  "version": "1.0",
  "framework": "TreeDex",
  "tree": [
    {
      "structure": "1",
      "title": "Introduction",
      "physical_index": 0,
      "node_id": "0001",
      "nodes": [
        {
          "structure": "1.1",
          "title": "Background",
          "physical_index": 0,
          "node_id": "0002",
          "nodes": []
        }
      ]
    }
  ],
  "pages": [
    {"page_num": 0, "text": "...", "token_count": 342}
  ]
}
```

---

## Error Handling

### JSON Extraction (Multi-Pass)

LLM output is often imperfect. `extract_json()` tries 4 strategies:

1. Direct `JSON.parse(text)` — clean output
2. Code block extraction (`` ```json ... ``` ``) — markdown-wrapped
3. Trailing comma fix (`, }` → `}`) — common LLM error
4. Brace/bracket matching — find outermost `{...}` or `[...]`

### Image Description (Graceful Fallback)

```
Has alt text?        → "[Image: alt text]"
Has vision LLM?      → "[Image: LLM description]"
Vision fails?        → "[Image present]"
No vision support?   → "[Image present]"
```

### API Failures

- HTTP errors include status code and response body
- Timeout: 120s default for fetch-based backends
- No automatic retries (user controls retry logic)

### Query Without LLM

```python
try:
    result = index.query("question")
except ValueError as e:
    # "No LLM provided. Pass llm= to query() or TreeDex constructor."
```

---

## Configuration & Tuning

### For Small Context Models (4k-8k)

```python
index = TreeDex.from_file("doc.pdf", llm, max_tokens=4000, overlap=2)
```

More page groups, more LLM calls, but each call fits within the context window. Increase `overlap` to 2 for better section boundary detection.

### For Large Context Models (128k+)

```python
index = TreeDex.from_file("doc.pdf", llm, max_tokens=100000)
```

Fewer groups, fewer LLM calls. A 300-page document might fit in 3-5 groups instead of 56.

### For Image-Heavy Documents

```python
llm = GeminiLLM(api_key)  # Must support vision
index = TreeDex.from_file("slides.pdf", llm, extract_images=True)
```

Images are described by the vision LLM and appended as `[Image: description]` to page text.

### Forcing Heading Detection

Heading detection is automatic when no ToC is found. To force it even with a custom loader:

```python
from treedex.loaders import PDFLoader
loader = PDFLoader(detect_headings=True)
pages = loader.load("doc.pdf")
index = TreeDex.from_pages(pages, llm)
```

---

## Limitations & Edge Cases

### Current Limitations

1. **Multi-column layouts** — Font-size detection works but column order may be wrong
2. **Dense tables** — Treated as regular text; no special table parsing
3. **RTL languages** — Text extraction works but heading detection may miss markers
4. **Streaming** — LLM responses must be complete (no streaming support)
5. **Concurrent queries** — Not thread-safe; use separate `TreeDex` instances
6. **Context overflow** — Retrieved context isn't capped; may exceed model limits for very large sections

### Edge Cases Handled

1. **Single-page sections** — `end_index` clamped to `>= start_index`
2. **Empty pages** — Token count is 0; grouping skips gracefully
3. **No ToC** — Falls back to LLM extraction with heading markers
4. **No headings detected** — Falls back to plain text (no font-size variation)
5. **Orphaned sections** — Synthetic parents auto-inserted
6. **Malformed LLM JSON** — Multi-pass extraction with fallbacks
7. **Missing node IDs in query** — Silently skipped (no crash)
8. **PDF without text** — Empty pages; images can still be described via vision LLM

### Not Handled

1. **Automatic section splitting** — Large sections aren't auto-split; use `find_large_sections()` to identify them
2. **Query result deduplication** — Overlapping page ranges aren't merged
3. **Incremental indexing** — Re-index entire document on changes
4. **Page-level granularity** — Minimum unit is a page; sub-page sections share the full page text

---

## Complexity Analysis

| Operation | Time | Space |
|-----------|------|-------|
| `extract_pages()` | O(pages) | O(pages × text) |
| `extract_toc()` | O(toc entries) | O(entries) |
| `group_pages()` | O(pages) | O(groups × text) |
| `list_to_tree()` | O(n) | O(n) |
| `repair_orphans()` | O(n × depth) | O(inserts) |
| `assign_page_ranges()` | O(n) | O(1) in-place |
| `assign_node_ids()` | O(n) | O(1) in-place |
| `embed_text_in_tree()` | O(n × pages_per_node) | O(text) |
| `create_node_mapping()` | O(n) | O(n) |
| `query()` | O(1 LLM call + n) | O(context text) |
| `save()` | O(n + pages) | O(JSON size) |
| `load()` | O(JSON size) | O(n + pages) |

Where n = number of tree nodes, typically 10-500 for most documents.
