---
layout: default
title: Getting Started
nav_order: 1
---

# Getting Started

## Installation

### Python

```bash
pip install treedex
```

With optional LLM providers:

```bash
pip install treedex[gemini]     # Google Gemini
pip install treedex[openai]     # OpenAI
pip install treedex[claude]     # Anthropic Claude
pip install treedex[all]        # All providers
```

### Node.js

```bash
npm install treedex
```

Install your preferred LLM SDK:

```bash
npm install @google/generative-ai   # Gemini
npm install openai                    # OpenAI
npm install @anthropic-ai/sdk        # Claude
```

---

## Quick Start

### Python

```python
from treedex import TreeDex, GeminiLLM

# 1. Create an LLM backend
llm = GeminiLLM(api_key="your-api-key")

# 2. Index a document
index = TreeDex.from_file("document.pdf", llm=llm)

# 3. See the tree structure
index.show_tree()

# 4. Query
result = index.query("What methods were used?")
print(result.pages_str)    # "pages 12-15"
print(result.reasoning)    # "Section 3 covers methodology"
print(result.context)      # Full text from those pages

# 5. Agentic mode — get a direct answer
result = index.query("What methods were used?", agentic=True)
print(result.answer)       # "The study used survey-based..."
```

### Node.js

```typescript
import { TreeDex, GeminiLLM } from "treedex";

// 1. Create an LLM backend
const llm = new GeminiLLM("your-api-key");

// 2. Index a document
const index = await TreeDex.fromFile("document.pdf", llm);

// 3. See the tree structure
index.showTree();

// 4. Query
const result = await index.query("What methods were used?");
console.log(result.pagesStr);    // "pages 12-15"
console.log(result.reasoning);   // "Section 3 covers methodology"
console.log(result.context);     // Full text

// 5. Agentic mode
const answer = await index.query("What methods?", { agentic: true });
console.log(answer.answer);
```

---

## Save & Load

Build once, query many times:

```python
# Save
index.save("my_index.json")

# Load later (no re-indexing needed)
loaded = TreeDex.load("my_index.json", llm=llm)
result = loaded.query("question?")
```

```typescript
await index.save("my_index.json");
const loaded = await TreeDex.load("my_index.json", llm);
const result = await loaded.query("question?");
```

The JSON index is **cross-compatible** — build in Python, query from Node.js, or vice versa.

---

## Supported Formats

| Format | Extension | Python Deps | Node.js Deps |
|--------|-----------|-------------|-------------|
| PDF | `.pdf` | `pymupdf` (included) | `pdfjs-dist` (included) |
| Plain text | `.txt`, `.md` | None | None |
| HTML | `.html`, `.htm` | None | `htmlparser2` (optional) |
| DOCX | `.docx` | `python-docx` | `mammoth` |

---

## How It Works (Summary)

1. **Load** — Extract pages from your document
2. **Detect** — Check for PDF table of contents or detect headings by font size
3. **Index** — Build a tree structure (from ToC directly, or via LLM extraction)
4. **Query** — LLM navigates the tree to find relevant sections
5. **Return** — Get context text, source pages, and reasoning

For PDFs with a table of contents, **zero LLM calls** are needed for indexing — the tree is built directly from the bookmarks.

Next: [Architecture →](architecture.md)
