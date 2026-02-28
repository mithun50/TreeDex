"""TreeDex: Tree-based document RAG framework."""

from treedex.core import TreeDex, QueryResult
from treedex.loaders import PDFLoader, TextLoader, HTMLLoader, DOCXLoader, auto_loader
from treedex.llm_backends import (
    GeminiLLM,
    OpenAILLM,
    ClaudeLLM,
    OllamaLLM,
    OpenAICompatibleLLM,
)

__version__ = "0.1.0"

__all__ = [
    "TreeDex",
    "QueryResult",
    "PDFLoader",
    "TextLoader",
    "HTMLLoader",
    "DOCXLoader",
    "auto_loader",
    "GeminiLLM",
    "OpenAILLM",
    "ClaudeLLM",
    "OllamaLLM",
    "OpenAICompatibleLLM",
]
