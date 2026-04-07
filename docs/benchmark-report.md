---
layout: default
title: Benchmark Report
nav_order: 9
---

# Benchmark Report: TreeDex vs Vector RAG

Real head-to-head comparison on a 244-page textbook. Same document, same queries, same retrieval math — only the indexing and retrieval approach differs.

---

## Test Setup

| | Detail |
|---|---|
| **Document** | Think Python 2nd Edition (Allen B. Downey) |
| **Pages** | 244 |
| **Tokens** | 120,256 (cl100k_base) |
| **PDF ToC** | 240 entries (22 chapters, 219 sections) |
| **Queries** | 20 with ground-truth page ranges |
| **Retrieval** | TF-IDF cosine similarity (same math for both) |

### TreeDex Setup
- PDF ToC extracted directly (zero LLM calls)
- 240-node hierarchical tree built from bookmarks
- Retrieval: TF-IDF over section titles + first 500 chars of text
- Top-3 sections returned per query

### Vector RAG Setup
- Fixed-size chunking: 500 words with 100-word overlap
- 303 chunks produced
- TF-IDF vectorization with L2-normalized cosine similarity
- 5,630-term vocabulary
- Top-5 chunks returned per query

---

## Results Summary

| Metric | TreeDex (ToC) | Vector RAG | Winner |
|:-------|:-------------:|:----------:|:------:|
| **Hit rate** | 60% (12/20) | 55% (11/20) | TreeDex |
| **Avg recall** | 60% | 33% | TreeDex |
| **Avg precision** | 30% | 13% | TreeDex |
| **Build time** | 4.2 ms | 216.7 ms | TreeDex (52x) |
| **Index size** | 8,517 tokens | 117,437 tokens | TreeDex (13.8x) |
| **LLM calls (build)** | 0 | 0 (+embedding model) | TreeDex |
| **Structure** | Hierarchical | Flat | TreeDex |
| **Page attribution** | Exact ranges | Approximate | TreeDex |

---

## Per-Query Breakdown

### Queries Where TreeDex Won

| Query | TreeDex | Vector RAG |
|-------|---------|------------|
| "How to catch exceptions?" | Hit (page 162) | Miss |
| "What is a list comprehension?" | Hit (pages 205-206) | Hit but scattered |
| "What are tuples?" | Hit (page 137) | Hit but noisy |

TreeDex found the right section because the ToC node was titled "Catching exceptions" — a direct semantic match. Vector RAG missed it because the query terms "catch" and "exceptions" appear across many chunks about error handling, debugging, and testing.

### Queries Where Vector RAG Won

| Query | TreeDex | Vector RAG |
|-------|---------|------------|
| "How does inheritance work?" | Miss (nearby section) | Hit (page 199) |
| "How to define functions?" | Miss | Hit (page 46, close) |

Vector RAG found relevant chunks because the full text contains many mentions of "inheritance" and "define functions" across multiple pages. TreeDex missed because the ToC section titles didn't exactly match the query terms.

### Queries Both Missed

| Query | Why Both Missed |
|-------|-----------------|
| "How to debug programs?" | "Debugging" appears in every chapter's glossary — too common |
| "How does string slicing work?" | Generic terms "string" and "slicing" match many sections |
| "What is an algorithm?" | The word "algorithm" appears throughout the book |

These failures are inherent to TF-IDF keyword matching. An LLM navigating TreeDex's titled tree would likely get these right since the section titles are unambiguous.

---

## Structural Comparison

```
TreeDex (hierarchical):              Vector RAG (flat):
─────────────────────                ─────────────────
[0002] 2: The way of the program     chunk_0: "1.3 The first..."
  [0003] 2.1: What is a program?     chunk_1: "1.4 Arithmetic..."
  [0004] 2.2: Running Python         chunk_2: "values and types..."
  [0005] 2.3: The first program      chunk_3: "formal and natural..."
  [0006] 2.4: Arithmetic operators   chunk_4: "debugging When..."
  [0007] 2.5: Values and types       chunk_5: "glossary algorithm..."
  [0008] 2.6: Formal languages       ...
  [0009] 2.7: Debugging              chunk_301: "...index Out of..."
  [0010] 2.8: Glossary               chunk_302: "...exercises Write..."
  [0011] 2.9: Exercises
[0012] 3: Variables, expressions...
  ...240 nodes total                 ...303 chunks total
```

TreeDex knows that "Arithmetic operators" is section 2.4 inside chapter 2 "The way of the program", spanning page 25. Vector RAG sees chunk_1 which happens to contain text about arithmetic but has no knowledge of where it sits in the document hierarchy.

---

## Index Size Comparison

| | TreeDex | Vector RAG | Ratio |
|---|:---:|:---:|:---:|
| Index tokens | 8,517 | 117,437 | **13.8x smaller** |
| On-disk JSON | ~1.5 MB (with text) | ~1.2 MB (chunks) | Similar |
| Stripped (no text) | ~50 KB | N/A | — |
| Human readable | Yes | No (vectors are opaque) | — |

TreeDex's 8,517-token tree structure (titles + page ranges + hierarchy) is what gets sent to the LLM at query time. The LLM reasons over a compact, structured overview rather than raw chunk text.

---

## Build Performance

| Stage | TreeDex | Vector RAG |
|-------|:-------:|:----------:|
| PDF extraction | 2,527 ms | 2,660 ms |
| Chunking / ToC parse | 4.2 ms | 91.8 ms |
| Vectorization | N/A | 124.9 ms |
| **Total build** | **4.2 ms** | **216.7 ms** |

TreeDex builds 52x faster because it reads the PDF outline metadata directly. In real vector RAG, the vectorization step would be replaced by neural embedding calls — hundreds of API calls or GPU inference passes for 303 chunks.

---

## Scaling Projection

For this 244-page document without a ToC (LLM extraction path):

| LLM Context | TreeDex Groups | TreeDex LLM Calls | Vector RAG Embedding Calls |
|:-----------:|:--------------:|:------------------:|:--------------------------:|
| 4k | 38 | 38 | 303 |
| 8k | 17 | 17 | 303 |
| 20k | 7 | 7 | 303 |
| 128k | 1 | 1 | 303 |
| **With PDF ToC** | **0** | **0** | **303** |

Vector RAG always needs to embed every chunk regardless of model context size. TreeDex with a PDF ToC needs zero calls at any scale.

---

## Key Takeaways

1. **TreeDex outperforms vector RAG on structured documents** — 60% vs 55% hit rate, 60% vs 33% recall, 30% vs 13% precision on a 244-page textbook

2. **Precision is TreeDex's strongest advantage** — 2.3x more precise because it retrieves coherent sections instead of scattered chunks

3. **Build cost is dramatically lower** — 4.2ms vs 217ms locally, and zero LLM/embedding calls when a PDF ToC exists

4. **Index is 13.8x smaller and human-readable** — you can inspect, edit, and version-control a TreeDex index

5. **Both approaches struggle with generic keyword queries** — "How to debug" matches everywhere. An LLM navigating TreeDex's tree would resolve this; TF-IDF cannot

6. **They're complementary** — TreeDex excels on structured docs with hierarchy; vector RAG excels on unstructured content with no inherent organization
