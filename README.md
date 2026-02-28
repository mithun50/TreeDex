# TreeDex

**Tree-based, vectorless document RAG framework.**

Index any document into a navigable tree structure, then retrieve relevant sections using any LLM. No vector databases, no embeddings — just structured tree retrieval.

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mithun50/TreeDex/blob/main/treedex_demo.ipynb)

---

## How It Works

```
PDF/TXT/HTML/DOCX → Pages → LLM extracts structure → Tree Index → Query → Relevant sections
```

1. **Load** — Extract pages from any supported format
2. **Index** — LLM analyzes page groups and extracts hierarchical structure (table of contents)
3. **Build** — Flat sections become a tree with page ranges and embedded text
4. **Query** — LLM selects relevant tree nodes for your question
5. **Return** — Get context text, source pages, and reasoning

---

## Supported LLM Providers

| Backend | Type | Dependencies |
|---------|------|-------------|
| `GeminiLLM` | Named provider | `google-generativeai` |
| `OpenAILLM` | Named provider | `openai` |
| `ClaudeLLM` | Named provider | `anthropic` |
| `OpenAICompatibleLLM` | **Universal** | **None (stdlib)** |
| `OllamaLLM` | Local | **None (stdlib)** |

### OpenAI-Compatible Endpoints (the main feature)

`OpenAICompatibleLLM` works with **any** service that speaks the OpenAI chat completions format:

| Service | Base URL |
|---------|----------|
| **Groq** | `https://api.groq.com/openai/v1` |
| **Together AI** | `https://api.together.xyz/v1` |
| **Fireworks** | `https://api.fireworks.ai/inference/v1` |
| **OpenRouter** | `https://openrouter.ai/api/v1` |
| **vLLM** | `http://localhost:8000/v1` |
| **LM Studio** | `http://localhost:1234/v1` |
| **Ollama** (OpenAI mode) | `http://localhost:11434/v1` |

---

## Quick Start

### Install

```bash
pip install pymupdf tiktoken
```

### With Gemini

```python
from treedex import TreeDex, GeminiLLM

llm = GeminiLLM(api_key="YOUR_KEY")
index = TreeDex.from_file("document.pdf", llm=llm)

result = index.query("What is the main argument?")
print(result.context)
print(result.pages_str)  # "pages 5-8, 12-15"
```

### With Groq (OpenAI-compatible)

```python
from treedex import TreeDex, OpenAICompatibleLLM

llm = OpenAICompatibleLLM(
    base_url="https://api.groq.com/openai/v1",
    api_key="gsk_...",
    model="llama-3.3-70b-versatile"
)
index = TreeDex.from_file("document.pdf", llm=llm)
result = index.query("Summarize chapter 2")
```

### With Local Ollama

```python
from treedex import TreeDex, OllamaLLM

llm = OllamaLLM(model="llama3")
index = TreeDex.from_file("document.pdf", llm=llm)
```

### Swap LLM at Query Time

```python
# Build index with one LLM
index = TreeDex.from_file("doc.pdf", llm=gemini_llm)

# Query with a different one
result = index.query("...", llm=groq_llm)
```

---

## Supported Document Formats

| Format | Loader | Extra Dependencies |
|--------|--------|--------------------|
| PDF | `PDFLoader` | `pymupdf` |
| TXT / MD | `TextLoader` | None |
| HTML | `HTMLLoader` | None (stdlib) |
| DOCX | `DOCXLoader` | `python-docx` |

Use `auto_loader(path)` for automatic format detection, or pass a specific loader:

```python
from treedex import TreeDex, TextLoader

index = TreeDex.from_file("notes.txt", llm=llm, loader=TextLoader())
```

---

## API Reference

### `TreeDex`

| Method | Description |
|--------|------------|
| `TreeDex.from_file(path, llm, ...)` | Build index from a file |
| `TreeDex.from_pages(pages, llm, ...)` | Build from pre-extracted pages |
| `TreeDex.from_tree(tree, pages, llm?)` | Create from existing tree |
| `index.query(question, llm?)` | Retrieve relevant sections |
| `index.save(path)` | Save index to JSON |
| `TreeDex.load(path, llm?)` | Load index from JSON |
| `index.show_tree()` | Print tree structure |
| `index.stats()` | Get index statistics |
| `index.find_large_sections(...)` | Find oversized nodes |

### `QueryResult`

| Property | Type | Description |
|----------|------|-------------|
| `.context` | `str` | Concatenated text from relevant sections |
| `.node_ids` | `list[str]` | IDs of selected tree nodes |
| `.page_ranges` | `list[tuple]` | `[(start, end), ...]` page ranges |
| `.pages_str` | `str` | Human-readable: `"pages 5-8, 12-15"` |
| `.reasoning` | `str` | LLM's explanation for selection |

---

## Architecture

```
┌─────────────┐
│  Document    │  PDF, TXT, HTML, DOCX
└──────┬──────┘
       │  Loader
       ▼
┌─────────────┐
│   Pages     │  [{page_num, text, token_count}, ...]
└──────┬──────┘
       │  group_pages() → token-budget chunks
       ▼
┌─────────────┐
│  LLM Call   │  Extract hierarchical structure
└──────┬──────┘
       │  list_to_tree() → assign_page_ranges() → embed_text()
       ▼
┌─────────────┐
│  Tree Index │  Navigable hierarchy with text at each node
└──────┬──────┘
       │  query() → LLM selects relevant nodes
       ▼
┌─────────────┐
│ QueryResult │  context + page references + reasoning
└─────────────┘
```

---

## License

MIT License — Mithun Gowda B
