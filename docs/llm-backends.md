---
layout: default
title: LLM Backends
nav_order: 5
---

# LLM Backends

TreeDex works with **every major AI provider** out of the box. All backends implement the same `BaseLLM` interface.

## Backend Hierarchy

```
BaseLLM (abstract)
├── SDK-based (lazy-loaded)
│   ├── GeminiLLM         google-generativeai / @google/generative-ai
│   ├── OpenAILLM         openai
│   ├── ClaudeLLM         anthropic / @anthropic-ai/sdk
│   ├── MistralLLM        mistralai / @mistralai/mistralai
│   └── CohereLLM         cohere / cohere-ai
│
├── OpenAI-compatible (zero deps — fetch/urllib only)
│   ├── GroqLLM           api.groq.com
│   ├── TogetherLLM       api.together.xyz
│   ├── FireworksLLM      api.fireworks.ai
│   ├── OpenRouterLLM     openrouter.ai
│   ├── DeepSeekLLM       api.deepseek.com
│   ├── CerebrasLLM       api.cerebras.ai
│   └── SambanovaLLM      api.sambanova.ai
│
├── Fetch-based (zero deps)
│   ├── HuggingFaceLLM    huggingface.co
│   └── OllamaLLM         localhost:11434
│
└── Universal
    ├── OpenAICompatibleLLM  any endpoint + key
    ├── LiteLLM              100+ providers (Python only)
    └── FunctionLLM          wrap any callable
```

## Quick Reference

| Backend | Constructor | Required |
|---------|------------|----------|
| `GeminiLLM` | `GeminiLLM(api_key, model="gemini-2.0-flash")` | API key |
| `OpenAILLM` | `OpenAILLM(api_key, model="gpt-4o")` | API key |
| `ClaudeLLM` | `ClaudeLLM(api_key, model="claude-sonnet-4-20250514")` | API key |
| `MistralLLM` | `MistralLLM(api_key, model="mistral-large-latest")` | API key |
| `CohereLLM` | `CohereLLM(api_key, model="command-r-plus")` | API key |
| `GroqLLM` | `GroqLLM(api_key, model="llama-3.3-70b-versatile")` | API key |
| `TogetherLLM` | `TogetherLLM(api_key, model="...")` | API key |
| `FireworksLLM` | `FireworksLLM(api_key, model="...")` | API key |
| `OpenRouterLLM` | `OpenRouterLLM(api_key, model="claude-sonnet-4")` | API key |
| `DeepSeekLLM` | `DeepSeekLLM(api_key, model="deepseek-chat")` | API key |
| `CerebrasLLM` | `CerebrasLLM(api_key, model="llama-3.3-70b")` | API key |
| `SambanovaLLM` | `SambanovaLLM(api_key, model="...")` | API key |
| `HuggingFaceLLM` | `HuggingFaceLLM(api_key, model="...")` | API key |
| `OllamaLLM` | `OllamaLLM(model="llama3", host="...")` | Ollama running |
| `OpenAICompatibleLLM` | `OpenAICompatibleLLM(base_url, api_key, model)` | URL + key |
| `LiteLLM` | `LiteLLM(model="gpt-4o")` | Python only |
| `FunctionLLM` | `FunctionLLM(fn)` | Any callable |

## Usage Examples

### SDK-Based Providers

```python
# Python
from treedex import GeminiLLM, OpenAILLM, ClaudeLLM

llm = GeminiLLM(api_key="...")
llm = OpenAILLM(api_key="...")
llm = ClaudeLLM(api_key="...")
```

```typescript
// TypeScript
import { GeminiLLM, OpenAILLM, ClaudeLLM } from "treedex";

const llm = new GeminiLLM("api-key");
const llm = new OpenAILLM("api-key");
const llm = new ClaudeLLM("api-key");
```

### Zero-Dependency Providers

These use raw HTTP — no SDK installation needed:

```python
from treedex import GroqLLM, DeepSeekLLM, OllamaLLM

llm = GroqLLM(api_key="...")        # Cloud
llm = DeepSeekLLM(api_key="...")    # Cloud
llm = OllamaLLM(model="llama3")    # Local
```

### Any OpenAI-Compatible Endpoint

```python
from treedex import OpenAICompatibleLLM

llm = OpenAICompatibleLLM(
    base_url="https://my-server.com/v1",
    api_key="my-key",
    model="my-model"
)
```

### Custom Function

```python
from treedex import FunctionLLM

llm = FunctionLLM(lambda prompt: my_api.generate(prompt))
```

### Custom Subclass

```python
from treedex import BaseLLM

class MyLLM(BaseLLM):
    def generate(self, prompt: str) -> str:
        return my_api.call(prompt)
```

## Vision Support

Three backends can describe images extracted from PDFs:

| Backend | Vision Method | Image Format |
|---------|--------------|-------------|
| GeminiLLM | `generate_content()` inline_data | Base64 |
| OpenAILLM | Chat completion image_url | Base64 data URI |
| ClaudeLLM | Messages API image source | Base64 + media_type |

Enable with `extract_images=True`:

```python
llm = GeminiLLM(api_key="...")  # Must support vision
index = TreeDex.from_file("slides.pdf", llm, extract_images=True)
```

Images are described by the vision LLM and appended as `[Image: description]` to page text. If the LLM doesn't support vision, images are marked as `[Image present]`.

## Environment Variables

Most backends also read API keys from environment variables:

| Backend | Environment Variable |
|---------|---------------------|
| GeminiLLM | `GOOGLE_API_KEY` |
| OpenAILLM | `OPENAI_API_KEY` |
| ClaudeLLM | `ANTHROPIC_API_KEY` |
| GroqLLM | `GROQ_API_KEY` |
| TogetherLLM | `TOGETHER_API_KEY` |
| HuggingFaceLLM | `HF_TOKEN` |

Next: [Benchmarks →](benchmarks.md)
