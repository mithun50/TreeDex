---
layout: default
title: Home
nav_order: 0
---

# TreeDex Documentation
{: .fs-9 }

Tree-based, vectorless document RAG framework.
{: .fs-6 .fw-300 }

Index any document into a navigable tree structure, then retrieve relevant sections using **any LLM**. No vector databases, no embeddings — just structured tree retrieval.
{: .fs-5 .fw-300 }

[Get Started](getting-started.md){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View on GitHub](https://github.com/mithun50/TreeDex){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## Why TreeDex?

| | TreeDex | Vector DB RAG |
|---|---|---|
| **Structure** | Preserves hierarchy (chapters → sections → subsections) | Flat chunks, no hierarchy |
| **Storage** | JSON file (human-readable, inspectable) | Opaque vector database |
| **Infrastructure** | None — just JSON files | Pinecone, Chroma, Weaviate, etc. |
| **Attribution** | Exact page ranges per section | Approximate chunk boundaries |
| **Dependencies** | 1 LLM API | 1 LLM + 1 embedding model + 1 database |
| **PDF with ToC** | **Zero LLM calls** for indexing | Still needs embedding |

## Key Features

- **18+ LLM providers** — Gemini, OpenAI, Claude, Mistral, Groq, Ollama, and more
- **Smart hierarchy detection** — PDF ToC extraction, font-size heading markers, orphan repair
- **Dual language** — Python and Node.js with identical APIs and cross-compatible index format
- **Agentic mode** — Retrieve context AND generate answers in one call
- **Image support** — Vision LLMs describe images embedded in PDFs

## v0.1.5 Highlights

- **PDF ToC extraction** — Zero LLM calls when PDF has bookmarks
- **Font-size heading detection** — `[H1]`/`[H2]`/`[H3]` markers from font analysis
- **Capped continuation context** — 90% token savings on large documents
- **Orphan repair** — Auto-insert synthetic parents for broken hierarchy

## Quick Example

```python
from treedex import TreeDex, GeminiLLM

llm = GeminiLLM(api_key="your-key")
index = TreeDex.from_file("textbook.pdf", llm=llm)
index.show_tree()

result = index.query("What are the main methods?", agentic=True)
print(result.answer)       # Direct answer
print(result.pages_str)    # "pages 45-52"
```

---

## Documentation

| Page | Description |
|------|-------------|
| [Getting Started](getting-started.md) | Installation, quick start, basic usage |
| [Architecture](architecture.md) | System design, pipeline, data types |
| [API Reference](api.md) | Complete function and class reference |
| [LLM Backends](llm-backends.md) | 18+ providers, vision support, custom backends |
| [Benchmarks](benchmarks.md) | Performance numbers, scaling characteristics |
| [Case Studies](case-studies.md) | Before/after comparisons, real-world scenarios |
| [Configuration](configuration.md) | Tuning guide for different use cases |
