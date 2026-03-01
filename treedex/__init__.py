"""TreeDex: Tree-based document RAG framework."""

from treedex.core import TreeDex, QueryResult
from treedex.loaders import PDFLoader, TextLoader, HTMLLoader, DOCXLoader, auto_loader
from treedex.llm_backends import (
    BaseLLM,
    GeminiLLM,
    OpenAILLM,
    ClaudeLLM,
    MistralLLM,
    CohereLLM,
    OpenAICompatibleLLM,
    GroqLLM,
    TogetherLLM,
    FireworksLLM,
    OpenRouterLLM,
    DeepSeekLLM,
    CerebrasLLM,
    SambanovaLLM,
    HuggingFaceLLM,
    OllamaLLM,
    LiteLLM,
    FunctionLLM,
)

__version__ = "0.1.2"

__all__ = [
    # Core
    "TreeDex",
    "QueryResult",
    # Loaders
    "PDFLoader",
    "TextLoader",
    "HTMLLoader",
    "DOCXLoader",
    "auto_loader",
    # LLM base
    "BaseLLM",
    "FunctionLLM",
    "LiteLLM",
    # SDK providers
    "GeminiLLM",
    "OpenAILLM",
    "ClaudeLLM",
    "MistralLLM",
    "CohereLLM",
    # OpenAI-compatible (stdlib, zero deps)
    "OpenAICompatibleLLM",
    "GroqLLM",
    "TogetherLLM",
    "FireworksLLM",
    "OpenRouterLLM",
    "DeepSeekLLM",
    "CerebrasLLM",
    "SambanovaLLM",
    # Other stdlib backends
    "HuggingFaceLLM",
    "OllamaLLM",
]
