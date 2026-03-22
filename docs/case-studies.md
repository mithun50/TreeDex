---
layout: default
title: Case Studies
nav_order: 6
---

# Case Studies

## 1. Hierarchy Fix — Before vs After

**Problem:** On a 21-page research paper, the old extraction treated all 41 sections as top-level nodes. Subsections like "1.1 Background" were at the same level as "1 Introduction".

**After v0.1.5 (PDF ToC extraction):**

| Metric | Before (flat) | After (hierarchy) | Change |
|--------|:------------:|:-----------------:|:------:|
| Root nodes | 41 | 10 | **-75.6%** |
| Max depth | 1 | 3 | **3x deeper** |
| Child nodes | 0 | 31 | Proper nesting |
| LLM calls | 1+ | 0 | **100% saved** |

**Output:**
```
[0001] 1: Introduction (pages 1-1)
  [0002] 1.1: Background (pages 1-1)
  [0003] 1.2: Limitations of vector-based RAG (pages 1-1)
  [0004] 1.3: Our contribution (pages 2-2)
[0005] 2: Related Work (pages 2-4)
  [0006] 2.1: Retrieval-augmented generation (pages 2-2)
  [0007] 2.2: Document chunking strategies (pages 3-3)
  [0008] 2.3: Structured and hierarchical retrieval (pages 3-3)
  ...
[0011] 3: System Architecture (pages 5-8)
  [0012] 3.1: Architecture overview (pages 5-5)
  [0013] 3.2: Document loading layer (pages 5-5)
  [0014] 3.3: Page grouping with token budget (pages 6-6)
  [0015] 3.4: LLM-based structure extraction (pages 7-7)
  [0016] 3.5: Tree construction (pages 7-7)
  [0017] 3.6: Query retrieval (pages 7-7)
  [0018] 3.7: LLM backend abstraction (pages 8-8)
```

10 correctly nested chapters with proper subsections. Zero LLM cost.

---

## 2. Heading Detection Impact

**What the LLM used to see (plain text):**
```
1 Introduction  1.1 Background  Large Language Models (LLMs),
accessible primarily through web APIs, have become foundational
components of modern web information systems...
```

Everything on one line. No hierarchy signals. The LLM has to guess whether "1.1 Background" is a chapter or subsection.

**What the LLM sees now (with heading markers):**
```
[H2] 1 Introduction
[H3] 1.1 Background
Large Language Models (LLMs), accessible primarily through web
APIs, have become foundational components of modern web
information systems...
```

The `[H2]` and `[H3]` markers come from font-size analysis:
- Title (17.2pt) → `[H1]`
- Chapter headings (12.0pt) → `[H2]`
- Section headings (11.0pt) → `[H3]`
- Body text (10.0pt) → no marker

**Stats for the research paper:**
- 3 `[H1]` markers (title)
- 12 `[H2]` markers (chapters)
- 31 `[H3]` markers (sections)
- Token overhead: **only +314 tokens (+2.7%)**

The prompt explicitly instructs the LLM:
> `[H1]` = top-level chapters (structure: "1", "2")
> `[H2]` = sections (structure: "1.1", "1.2")
> `[H3]` = subsections (structure: "1.1.1", "1.1.2")

---

## 3. Capped Continuation Context

**Scenario:** Indexing a 500-page textbook. The LLM processes page groups sequentially. By group 50 of 56, ~900 sections have been extracted.

**Old approach:**
```json
// Sent to LLM as "previous structure" — ALL 900+ sections
[
  {"structure": "1", "title": "Chapter 1", "physical_index": 0},
  {"structure": "1.1", "title": "Section 1.1", "physical_index": 2},
  {"structure": "1.1.1", "title": "Subsection 1.1.1", "physical_index": 3},
  // ... 897 more sections
  {"structure": "8.5.3", "title": "Last extracted", "physical_index": 489}
]
// = 317,200 tokens just for context!
```

This **exceeds most model context windows** and causes the LLM to truncate or hallucinate.

**New approach (capped):**
```json
{
  "top_level_sections": [
    {"structure": "1", "title": "Chapter 1", "physical_index": 0},
    {"structure": "2", "title": "Chapter 2", "physical_index": 30},
    // ... only 15 top-level entries
  ],
  "recent_sections (last 30)": [
    {"structure": "8.4.2", "title": "...", "physical_index": 475},
    // ... last 30 sections in detail
  ],
  "total_sections_so_far": 976,
  "last_structure_id": "8.5.3"
}
// = 31,200 tokens — fits comfortably
```

| Document | Old Context | Capped Context | Savings |
|:--------:|:-----------:|:-------------:|:-------:|
| 100 pages | 9,750 tok | 4,800 tok | 50.8% |
| 300 pages | 117,200 tok | 19,200 tok | 83.6% |
| 500 pages | 317,200 tok | 31,200 tok | **90.2%** |

---

## 4. Orphan Repair

**Scenario:** The LLM processes chunk 8 and outputs `"2.3.1"` — but chunks 1-7 never produced `"2"` or `"2.3"`. Without repair, `"2.3.1"` becomes a root node.

**Mild case (1 missing parent):**
```
Input:                    After repair:
1    — Introduction       1    — Introduction
1.1  — Background         1.1  — Background
2.1  — Data (no "2")      2    — Section 2      ← synthetic
                          2.1  — Data
```

**Severe case (deep orphan chain):**
```
Input:                      After repair:
1    — Introduction         1    — Introduction
1.1  — Background           1.1  — Background
2.3.1 — Deep orphan         2    — Section 2      ← synthetic
3.1.2 — Another orphan      2.3  — Section 2.3    ← synthetic
4    — Conclusion           2.3.1 — Deep orphan
                            3    — Section 3      ← synthetic
                            3.1  — Section 3.1    ← synthetic
                            3.1.2 — Another orphan
                            4    — Conclusion
```

5 input → 9 after repair. 4 synthetic parents inserted. The tree now has correct 3-level hierarchy instead of 3 orphaned root nodes.

---

## 5. TreeDex vs Vector DB RAG

### Feature Comparison

| Dimension | TreeDex | Vector DB (Chroma/Pinecone) |
|-----------|:-------:|:---------------------------:|
| **Index structure** | Hierarchical tree | Flat vector space |
| **Storage format** | JSON (human-readable) | Vector database (opaque) |
| **Retrieval method** | LLM navigates tree | Cosine similarity |
| **Preserves structure** | Chapters → sections → subsections | No hierarchy |
| **Source attribution** | Exact page ranges | Approximate chunk IDs |
| **Infrastructure** | None (just JSON files) | Database server |
| **Dependencies** | 1 LLM API | 1 LLM + 1 embedding + 1 DB |
| **Debugging** | Read the JSON tree | Query embedding space |
| **Cost per index** | N LLM calls (or 0 with ToC) | N embedding calls |
| **Cost per query** | 1 LLM call | 1 embedding + 1 LLM call |

### When to Use TreeDex

- Structured documents: papers, textbooks, manuals, reports, legal docs
- Need exact page-level attribution
- Want a human-inspectable index
- Don't want to run a vector database
- PDFs with bookmarks (zero LLM indexing cost)

### When to Use Vector DB

- Unstructured content: chat logs, mixed media, knowledge bases
- Need sub-sentence matching
- Already have embedding infrastructure
- Documents with no inherent hierarchy

### Performance Profile

| Metric | TreeDex | Vector DB |
|--------|:-------:|:---------:|
| Index build time | Seconds (LLM calls) | Seconds (embedding calls) |
| Index size | 20-100 KB (JSON) | Varies (vectors) |
| Query latency | 1 LLM call (~0.5-3s) | 1 similarity search (~50ms) + 1 LLM call |
| Accuracy on structured docs | High (preserves hierarchy) | Medium (loses structure) |
| Accuracy on unstructured | Medium | High (semantic matching) |

Next: [Configuration →](configuration.md)
