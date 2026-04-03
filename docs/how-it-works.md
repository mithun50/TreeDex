---
layout: default
title: How It Works
nav_order: 3
---

# How It Works

A step-by-step walkthrough of what TreeDex does from the moment you load a document to the moment you get an answer.

---

## Phase 1 — Loading

```python
index = TreeDex.from_file("document.pdf", llm)
```

TreeDex reads the document and converts it into a flat list of **pages**, each with:
- `page_num` — position in the document
- `text` — extracted text content
- `token_count` — pre-computed token length
- `images` *(optional)* — base64-encoded images if `extract_images=True`

Supported formats: **PDF, TXT, HTML, DOCX**. Use `auto_loader` / `autoLoader` to detect format automatically.

---

## Phase 2 — Structure Detection

TreeDex tries three strategies, in order:

### Strategy A — PDF Bookmarks (zero LLM calls)
If the PDF has native bookmarks/outline, the tree is built directly from them. This is the fastest and most accurate path — no LLM is needed at all.

### Strategy B — Font-Size Heading Detection
If no bookmarks exist, TreeDex analyzes font sizes across up to 50 pages. It identifies the body text size (the most frequent) and maps larger sizes to `[H1]`, `[H2]`, `[H3]` markers, which are injected into the page text before the LLM sees it.

```
[H1] Chapter 1: Introduction
This chapter covers the background...

[H2] 1.1 Motivation
The problem we are solving is...
```

### Strategy C — LLM Structure Extraction
Pages are grouped into token-capped chunks. The LLM is given each chunk and asked to extract a hierarchical structure — section titles, their nesting level, and their page positions.

For large documents, instead of passing the full growing section list back to the LLM on each chunk, TreeDex sends a **capped summary** (top-level sections + last 30 sections), preventing prompt bloat.

---

## Phase 3 — Tree Construction

The raw section list from the LLM is a flat list like:

```json
[
  { "structure": "1",   "title": "Introduction", "physical_index": 0 },
  { "structure": "1.1", "title": "Background",   "physical_index": 1 },
  { "structure": "2",   "title": "Methods",      "physical_index": 4 }
]
```

TreeDex then:

1. **Repairs orphans** — if `"2.3.1"` exists but `"2.3"` doesn't, a synthetic `"2.3"` parent is inserted automatically.
2. **Builds the tree** — dot-notation IDs (`"1.2.3"`) are converted into a nested `TreeNode[]` hierarchy using a hash map.
3. **Assigns page ranges** — each node gets a `start_index` and `end_index` covering all pages it spans.
4. **Assigns node IDs** — each node gets a short unique ID (`"0001"`, `"0002"`, …) used during retrieval.
5. **Embeds text** — actual page content is attached to each node based on its page range.

---

## Phase 4 — Querying

```python
result = index.query("What are the safety guidelines?")
```

### Step 1 — Strip content from the tree
A deep clone of the tree is made with **all `text` fields removed**. Only titles, structure IDs, and page ranges remain. This is the "skeleton".

### Step 2 — LLM navigates the skeleton
The skeleton (typically 1–2k tokens even for 300-page docs) is sent to the LLM along with your question:

```
You are a document retrieval system. Given this tree structure, pick
the node_ids most relevant to the query. Return JSON only.

{ "node_ids": ["0005"], "reasoning": "Safety section covers this." }
```

The LLM reasons over **titles and hierarchy only** — it never sees page content at this stage.

### Step 3 — Content fetched via hash map
Selected `node_ids` are looked up in a pre-built `O(1)` hash map. The actual page text for those nodes is retrieved and formatted:

```
[2: Safety Guidelines]
Section 2 covers personal protective equipment...
```

### Step 4 — Return result
A `QueryResult` is returned with:
- `.context` — the retrieved text
- `.node_ids` — which nodes were selected
- `.pages_str` — e.g. `"pages 5-9"`
- `.reasoning` — the LLM's explanation

---

## Phase 5 — Agentic Mode (optional)

```python
result = index.query("What are the safety guidelines?", agentic=True)
```

A **second LLM call** is made — this time passing the retrieved context and asking for a direct answer. Without agentic mode you get the raw context and control the final step yourself.

| Mode | LLM calls | You get |
|---|---|---|
| Default | 1 | Raw context + page references |
| `agentic=True` | 2 | Raw context + a generated answer |

---

## Multi-Index Querying

```python
multi = TreeDex.query_all([index_a, index_b], "question", labels=["Doc A", "Doc B"])
```

Each index is queried independently. Results are merged into a single `MultiQueryResult` with clear `[Doc A]` / `[Doc B]` headers separating each source's context. Optionally, a single agentic answer is generated over the combined context.

---

## Full Flow Diagram

```
Document (PDF / TXT / HTML / DOCX)
    │
    ▼
[ Loader ] ──────────────────────────────→ Pages[]
    │
    ├── PDF bookmarks found?
    │       YES → tocToSections()                   (0 LLM calls)
    │       NO  → font-size heading detection
    │               → chunked LLM structure extraction
    │
    ▼
repairOrphans() → listToTree()
    │
    ▼
assignPageRanges() → assignNodeIds() → embedTextInTree()
    │
    ▼
  TreeDex index ready  (save/load as JSON)

──────────────────────────── QUERY TIME ────────────────────────────

index.query("your question")
    │
    ▼
[1] stripTextFromTree()          ← skeleton only, no content
    │
    ▼
[2] retrievalPrompt → LLM        ← 1st LLM call
    │  returns: { node_ids, reasoning }
    ▼
[3] extractJson()                ← robust parse
    │
    ▼
[4] collectNodeTexts(_nodeMap)   ← O(1) hash lookup
    │
    ▼
[5] answerPrompt → LLM           ← 2nd LLM call (agentic only)
    │
    ▼
QueryResult { context, nodeIds, pageRanges, reasoning, answer }
```
