---
layout: default
title: Benchmarks
nav_order: 5
---

# Benchmarks

All benchmarks measured on `research-paper.pdf` (21 pages, 11,710 tokens, 41 ToC entries).
Node.js runtime, `performance.now()` timing.

---

## Core Operations

| Operation | Time | Notes |
|-----------|------|-------|
| **ToC extraction** | 30.9 ms | Reads PDF outline metadata |
| **Page extraction** (plain) | 298.9 ms | Standard text extraction |
| **Page extraction** (headings) | 423.5 ms | +41.7% for font-size analysis |
| **Heading token overhead** | +314 tokens | +2.7% (12,024 vs 11,710) |

**Takeaway:** Heading detection adds ~125ms but only 2.7% more tokens — a worthwhile tradeoff for significantly better hierarchy accuracy.

---

## Page Grouping

How documents split based on LLM context window size:

| max_tokens | Groups | Avg tokens/group | Time |
|:----------:|:------:|:-----------------:|:----:|
| 4,000 | 4 | 3,434 | 0.6 ms |
| 8,000 | 2 | 6,279 | 0.1 ms |
| 20,000 | 1 | 11,958 | 0.07 ms |
| 128,000 | 1 | 11,958 | 0.05 ms |

### Scaling to Large Documents

For a simulated 1M-token document (500 pages):

| LLM Context | Groups | LLM Calls | Pages/Group |
|:-----------:|:------:|:---------:|:-----------:|
| 4k | 499 | 499 | ~2 |
| 8k | 167 | 167 | ~3 |
| **20k (default)** | **56** | **56** | **~9** |
| 128k | 8 | 8 | ~63 |

---

## Tree Building

Time for `listToTree()` + `assignPageRanges()` + `assignNodeIds()`:

| Sections | Build Time | Tree Nodes | Roots |
|:--------:|:----------:|:----------:|:-----:|
| 10 | 0.6 ms | 12 | 2 |
| 50 | 0.3 ms | 50 | 10 |
| 200 | 0.5 ms | 200 | 40 |
| 500 | 1.3 ms | 500 | 100 |

Tree building is **sub-millisecond** for typical documents and scales linearly.

---

## Orphan Repair

Time to detect and insert synthetic parent nodes:

| Orphan Count | Time | Input → Output | Synthetic Parents |
|:------------:|:----:|:--------------:|:-----------------:|
| 5 | 0.2 ms | 10 → 20 | 10 |
| 20 | 0.5 ms | 25 → 65 | 40 |
| 50 | 1.5 ms | 55 → 155 | 100 |
| 100 | 3.0 ms | 105 → 305 | 200 |

---

## ToC Conversion

`tocToSections()` performance:

| ToC Entries | Time per Call | 1000 Calls |
|:-----------:|:-------------:|:----------:|
| 10 | 13 μs | 12.8 ms |
| 50 | 44 μs | 43.7 ms |
| 200 | 156 μs | 155.6 ms |

---

## Capped Continuation Context

Token savings when using capped vs full context in continuation prompts:

| Document | Sections | Old (full JSON) | New (capped) | Savings |
|:--------:|:--------:|:---------------:|:------------:|:-------:|
| 100 pages | 195 | 9,750 tok | 4,800 tok | **50.8%** |
| 300 pages | 586 | 117,200 tok | 19,200 tok | **83.6%** |
| 500 pages | 976 | 317,200 tok | 31,200 tok | **90.2%** |

The capped context sends: top-level chapters + last 30 sections + metadata.

---

## Memory Usage

Full indexing pipeline for the 21-page research paper:

| Metric | Value |
|--------|-------|
| Heap delta | +1.54 MB |
| RSS delta | +4.70 MB |
| External delta | +0.84 MB |

---

## End-to-End Comparison

### ToC Path vs LLM Path

| Metric | ToC Path | LLM Path |
|--------|:--------:|:--------:|
| LLM calls | **0** | 1+ |
| Total time (no LLM) | ~330 ms | ~330 ms + LLM latency |
| Accuracy | Perfect (from bookmarks) | Depends on LLM quality |
| Token cost | **0** | 12k+ per group |

### With vs Without v0.1.5 Improvements

| Metric | Before v0.1.5 | After v0.1.5 |
|--------|:-------------:|:------------:|
| Root nodes (21-page paper) | 41 (all flat) | 10 (correct hierarchy) |
| Max tree depth | 1 | 3 |
| Continuation context (500pg) | 317,200 tokens | 31,200 tokens |
| Orphaned sections | Silently promoted to root | Auto-repaired |
| PDF with ToC | Still uses LLM | **0 LLM calls** |

Next: [Case Studies →](case-studies.md)
