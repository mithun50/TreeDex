---
layout: default
title: Configuration
nav_order: 7
---

# Configuration & Tuning

## Context Window Sizing

The `max_tokens` parameter controls how many pages fit in each LLM extraction call.

### Small Context Models (4k-8k)

```python
index = TreeDex.from_file("doc.pdf", llm, max_tokens=4000, overlap=2)
```

- More page groups → more LLM calls
- Increase `overlap` to 2 for better section boundary detection
- Good for: Groq (free tier), Ollama local models

### Default (20k)

```python
index = TreeDex.from_file("doc.pdf", llm)  # max_tokens=20000
```

- Balanced for most models (GPT-4o, Gemini Flash, Claude Sonnet)
- A 300-page doc splits into ~56 groups

### Large Context Models (128k+)

```python
index = TreeDex.from_file("doc.pdf", llm, max_tokens=100000)
```

- Fewer groups, fewer LLM calls, faster indexing
- A 300-page doc might fit in 3-5 groups
- Good for: GPT-4o (128k), Gemini 1.5 Pro (1M), Claude (200k)

### Impact Table

| max_tokens | Groups (300pg doc) | LLM Calls | Best For |
|:----------:|:-----------------:|:---------:|:--------:|
| 4,000 | ~250 | 250 | Free tier / small models |
| 8,000 | ~125 | 125 | Standard models |
| 20,000 | ~56 | 56 | Default (most models) |
| 50,000 | ~20 | 20 | GPT-4o, Claude Sonnet |
| 100,000 | ~8 | 8 | Gemini 1.5 Pro, Claude |

---

## Image Extraction

For image-heavy documents (presentations, illustrated textbooks):

```python
# Requires a vision-capable LLM
llm = GeminiLLM(api_key="...")  # or OpenAILLM, ClaudeLLM
index = TreeDex.from_file("slides.pdf", llm, extract_images=True)
```

**How it works:**
1. Images extracted as base64 from each PDF page
2. Vision LLM describes each image in 1-2 sentences
3. Descriptions appended to page text as `[Image: description]`
4. Tree nodes include image context in their text

**Fallbacks:**
- Image has alt text → uses alt text directly
- LLM supports vision → generates description
- LLM doesn't support vision → marks as `[Image present]`
- Description fails → marks as `[Image present]`

---

## Heading Detection

Heading detection is **automatic** for PDFs when no ToC is found. To force it:

```python
from treedex import PDFLoader, TreeDex

# Force heading detection
loader = PDFLoader(detect_headings=True)
pages = loader.load("doc.pdf")
index = TreeDex.from_pages(pages, llm)
```

```typescript
import { PDFLoader, TreeDex } from "treedex";

const loader = new PDFLoader({ detectHeadings: true });
const pages = await loader.load("doc.pdf");
const index = await TreeDex.fromPages(pages, llm);
```

**When heading detection helps most:**
- Documents without PDF bookmarks/outline
- Scanned PDFs with OCR text
- Documents with consistent heading font sizes

**When it may not help:**
- All text uses the same font size
- Multi-column layouts with varying sizes
- Decorative fonts that vary in size

---

## Overlap Tuning

The `overlap` parameter controls how many pages are shared between adjacent groups.

```python
# Default: 1 page overlap
index = TreeDex.from_file("doc.pdf", llm, overlap=1)

# More overlap for dense documents
index = TreeDex.from_file("doc.pdf", llm, overlap=2)

# No overlap (faster but may miss boundary sections)
index = TreeDex.from_file("doc.pdf", llm, overlap=0)
```

| Overlap | Pros | Cons |
|:-------:|------|------|
| 0 | Fewest tokens, fastest | May split sections at boundaries |
| **1** (default) | Good boundary coverage | Standard token usage |
| 2 | Better for dense docs | ~5-10% more tokens |
| 3+ | Rarely needed | Diminishing returns |

---

## Verbose Output

Disable progress logging for production:

```python
index = TreeDex.from_file("doc.pdf", llm, verbose=False)
```

When enabled (default), you'll see:

```
Loading: document.pdf
  Found PDF table of contents (41 entries)
  21 pages, 11,710 tokens
  Built 41 sections from PDF ToC (no LLM needed)
  Tree: 41 nodes
```

Or for LLM extraction:

```
Loading: document.pdf
  21 pages, 11,710 tokens
  1 page group(s) for structure extraction
  Extracting structure from group 1/1...
  Extracted 41 sections
  Tree: 41 nodes
```

---

## Finding Large Sections

After indexing, identify sections that may be too large for effective retrieval:

```python
large = index.find_large_sections(max_pages=10, max_tokens=20000)
for node in large:
    print(f"{node['title']}: pages {node['start_index']}-{node['end_index']}")
```

This helps identify sections that might benefit from manual splitting or re-indexing with a finer-grained structure.

---

## Cross-Language Index Sharing

Build in Python, query from Node.js (or vice versa):

```python
# Python: build and save
index = TreeDex.from_file("doc.pdf", llm=gemini)
index.save("shared_index.json")
```

```typescript
// Node.js: load and query
const index = await TreeDex.load("shared_index.json", llm);
const result = await index.query("question?");
```

The JSON index format uses `snake_case` field names and is fully compatible across both languages.
