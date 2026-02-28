"""LLM backends for TreeDex.

Hierarchy:
    BaseLLM                     — abstract base, subclass for custom LLMs
    ├── GeminiLLM               — Google Gemini (lazy SDK)
    ├── OpenAILLM               — OpenAI (lazy SDK)
    ├── ClaudeLLM               — Anthropic Claude (lazy SDK)
    ├── MistralLLM              — Mistral AI (lazy SDK)
    ├── CohereLLM               — Cohere (lazy SDK)
    ├── OpenAICompatibleLLM     — Any OpenAI-compatible endpoint (stdlib only)
    │   ├── GroqLLM             — Groq (pre-configured URL)
    │   ├── TogetherLLM         — Together AI (pre-configured URL)
    │   ├── FireworksLLM        — Fireworks AI (pre-configured URL)
    │   ├── OpenRouterLLM       — OpenRouter (pre-configured URL)
    │   ├── DeepSeekLLM         — DeepSeek (pre-configured URL)
    │   ├── CerebrasLLM         — Cerebras (pre-configured URL)
    │   └── SambanovaLLM        — SambaNova (pre-configured URL)
    ├── HuggingFaceLLM          — HuggingFace Inference API (stdlib only)
    ├── OllamaLLM               — Ollama native /api/generate (stdlib only)
    ├── LiteLLM                 — litellm wrapper (100+ providers)
    └── FunctionLLM             — Wrap any callable(str) -> str

Named providers lazy-import their SDKs.
OpenAICompatibleLLM, HuggingFaceLLM, OllamaLLM use only stdlib (urllib).
"""

import json
import urllib.request
import urllib.error
from abc import ABC, abstractmethod

try:
    import requests as _requests
except ImportError:
    _requests = None


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

class BaseLLM(ABC):
    """Base class for all LLM backends.

    Subclass this to create your own backend — just implement generate():

        class MyLLM(BaseLLM):
            def generate(self, prompt: str) -> str:
                return my_api_call(prompt)
    """

    @abstractmethod
    def generate(self, prompt: str) -> str:
        """Send a prompt and return the generated text."""

    def __repr__(self):
        return f"{self.__class__.__name__}()"


# ---------------------------------------------------------------------------
# Named SDK providers (lazy imports)
# ---------------------------------------------------------------------------

class GeminiLLM(BaseLLM):
    """Google Gemini via google-generativeai SDK.

    pip install google-generativeai
    """

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        self.api_key = api_key
        self.model_name = model
        self._client = None

    def _get_client(self):
        if self._client is None:
            import google.generativeai as genai

            genai.configure(api_key=self.api_key)
            self._client = genai.GenerativeModel(self.model_name)
        return self._client

    def generate(self, prompt: str) -> str:
        model = self._get_client()
        response = model.generate_content(prompt)
        return response.text

    def __repr__(self):
        return f"GeminiLLM(model={self.model_name!r})"


class OpenAILLM(BaseLLM):
    """OpenAI via openai SDK.

    pip install openai
    """

    def __init__(self, api_key: str, model: str = "gpt-4o"):
        self.api_key = api_key
        self.model_name = model
        self._client = None

    def _get_client(self):
        if self._client is None:
            import openai

            self._client = openai.OpenAI(api_key=self.api_key)
        return self._client

    def generate(self, prompt: str) -> str:
        client = self._get_client()
        response = client.chat.completions.create(
            model=self.model_name,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content

    def __repr__(self):
        return f"OpenAILLM(model={self.model_name!r})"


class ClaudeLLM(BaseLLM):
    """Anthropic Claude via anthropic SDK.

    pip install anthropic
    """

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514"):
        self.api_key = api_key
        self.model_name = model
        self._client = None

    def _get_client(self):
        if self._client is None:
            import anthropic

            self._client = anthropic.Anthropic(api_key=self.api_key)
        return self._client

    def generate(self, prompt: str) -> str:
        client = self._get_client()
        response = client.messages.create(
            model=self.model_name,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text

    def __repr__(self):
        return f"ClaudeLLM(model={self.model_name!r})"


class MistralLLM(BaseLLM):
    """Mistral AI via mistralai SDK.

    pip install mistralai
    """

    def __init__(self, api_key: str, model: str = "mistral-large-latest"):
        self.api_key = api_key
        self.model_name = model
        self._client = None

    def _get_client(self):
        if self._client is None:
            from mistralai import Mistral

            self._client = Mistral(api_key=self.api_key)
        return self._client

    def generate(self, prompt: str) -> str:
        client = self._get_client()
        response = client.chat.complete(
            model=self.model_name,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content

    def __repr__(self):
        return f"MistralLLM(model={self.model_name!r})"


class CohereLLM(BaseLLM):
    """Cohere via cohere SDK.

    pip install cohere
    """

    def __init__(self, api_key: str, model: str = "command-r-plus"):
        self.api_key = api_key
        self.model_name = model
        self._client = None

    def _get_client(self):
        if self._client is None:
            import cohere

            self._client = cohere.ClientV2(api_key=self.api_key)
        return self._client

    def generate(self, prompt: str) -> str:
        client = self._get_client()
        response = client.chat(
            model=self.model_name,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.message.content[0].text

    def __repr__(self):
        return f"CohereLLM(model={self.model_name!r})"


# ---------------------------------------------------------------------------
# OpenAI-compatible (stdlib only) + convenience wrappers
# ---------------------------------------------------------------------------

class OpenAICompatibleLLM(BaseLLM):
    """Universal backend for any OpenAI-compatible API endpoint.

    Works with: Groq, Together AI, Fireworks, vLLM, LM Studio,
    OpenRouter, DeepSeek, Cerebras, SambaNova, Ollama (OpenAI mode),
    and any other compatible service.

    Uses `requests` if available (avoids Cloudflare blocks),
    falls back to stdlib `urllib`.
    """

    def __init__(
        self,
        base_url: str,
        model: str,
        api_key: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.0,
        extra_headers: dict | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.extra_headers = extra_headers or {}

    def _build_headers(self) -> dict:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "TreeDex/0.1",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        headers.update(self.extra_headers)
        return headers

    def generate(self, prompt: str) -> str:
        url = f"{self.base_url}/chat/completions"

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
        }

        headers = self._build_headers()

        if _requests is not None:
            resp = _requests.post(url, json=payload, headers=headers, timeout=120)
            if resp.status_code != 200:
                raise RuntimeError(
                    f"API request failed ({resp.status_code}): {resp.text}"
                )
            body = resp.json()
        else:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=120) as resp:
                    body = json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as e:
                error_body = e.read().decode("utf-8", errors="replace")
                raise RuntimeError(
                    f"API request failed ({e.code}): {error_body}"
                ) from e

        return body["choices"][0]["message"]["content"]

    def __repr__(self):
        return f"OpenAICompatibleLLM(base_url={self.base_url!r}, model={self.model!r})"


class GroqLLM(BaseLLM):
    """Groq — fast LLM inference.

    Uses the official `groq` SDK (pip install groq).
    Get your API key at: https://console.groq.com
    """

    def __init__(self, api_key: str, model: str = "llama-3.3-70b-versatile"):
        self.api_key = api_key
        self.model = model
        self._client = None

    def _get_client(self):
        if self._client is None:
            from groq import Groq

            self._client = Groq(api_key=self.api_key)
        return self._client

    def generate(self, prompt: str) -> str:
        client = self._get_client()
        response = client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content

    def __repr__(self):
        return f"GroqLLM(model={self.model!r})"


class TogetherLLM(OpenAICompatibleLLM):
    """Together AI — open-source models. Zero SDK dependencies.

    Get your API key at: https://api.together.xyz
    """

    def __init__(self, api_key: str, model: str = "meta-llama/Llama-3-70b-chat-hf", **kwargs):
        super().__init__(
            base_url="https://api.together.xyz/v1",
            model=model,
            api_key=api_key,
            **kwargs,
        )

    def __repr__(self):
        return f"TogetherLLM(model={self.model!r})"


class FireworksLLM(OpenAICompatibleLLM):
    """Fireworks AI — fast open-source inference. Zero SDK dependencies.

    Get your API key at: https://fireworks.ai
    """

    def __init__(self, api_key: str, model: str = "accounts/fireworks/models/llama-v3p1-70b-instruct", **kwargs):
        super().__init__(
            base_url="https://api.fireworks.ai/inference/v1",
            model=model,
            api_key=api_key,
            **kwargs,
        )

    def __repr__(self):
        return f"FireworksLLM(model={self.model!r})"


class OpenRouterLLM(OpenAICompatibleLLM):
    """OpenRouter — access any model via one API. Zero SDK dependencies.

    Get your API key at: https://openrouter.ai
    """

    def __init__(self, api_key: str, model: str = "anthropic/claude-sonnet-4", **kwargs):
        super().__init__(
            base_url="https://openrouter.ai/api/v1",
            model=model,
            api_key=api_key,
            **kwargs,
        )

    def __repr__(self):
        return f"OpenRouterLLM(model={self.model!r})"


class DeepSeekLLM(OpenAICompatibleLLM):
    """DeepSeek — powerful reasoning models. Zero SDK dependencies.

    Get your API key at: https://platform.deepseek.com
    """

    def __init__(self, api_key: str, model: str = "deepseek-chat", **kwargs):
        super().__init__(
            base_url="https://api.deepseek.com/v1",
            model=model,
            api_key=api_key,
            **kwargs,
        )

    def __repr__(self):
        return f"DeepSeekLLM(model={self.model!r})"


class CerebrasLLM(OpenAICompatibleLLM):
    """Cerebras — ultra-fast inference. Zero SDK dependencies.

    Get your API key at: https://cloud.cerebras.ai
    """

    def __init__(self, api_key: str, model: str = "llama-3.3-70b", **kwargs):
        super().__init__(
            base_url="https://api.cerebras.ai/v1",
            model=model,
            api_key=api_key,
            **kwargs,
        )

    def __repr__(self):
        return f"CerebrasLLM(model={self.model!r})"


class SambanovaLLM(OpenAICompatibleLLM):
    """SambaNova — fast AI inference. Zero SDK dependencies.

    Get your API key at: https://cloud.sambanova.ai
    """

    def __init__(self, api_key: str, model: str = "Meta-Llama-3.1-70B-Instruct", **kwargs):
        super().__init__(
            base_url="https://api.sambanova.ai/v1",
            model=model,
            api_key=api_key,
            **kwargs,
        )

    def __repr__(self):
        return f"SambanovaLLM(model={self.model!r})"


# ---------------------------------------------------------------------------
# HuggingFace Inference API (stdlib only)
# ---------------------------------------------------------------------------

class HuggingFaceLLM(BaseLLM):
    """HuggingFace Inference API. Zero SDK dependencies.

    Works with any text-generation model on HuggingFace.
    Get your token at: https://huggingface.co/settings/tokens
    """

    def __init__(
        self,
        api_key: str,
        model: str = "mistralai/Mistral-7B-Instruct-v0.3",
        max_tokens: int = 4096,
    ):
        self.api_key = api_key
        self.model = model
        self.max_tokens = max_tokens

    def generate(self, prompt: str) -> str:
        url = f"https://api-inference.huggingface.co/models/{self.model}/v1/chat/completions"

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": self.max_tokens,
        }

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "TreeDex/0.1",
            "Authorization": f"Bearer {self.api_key}",
        }

        if _requests is not None:
            resp = _requests.post(url, json=payload, headers=headers, timeout=120)
            if resp.status_code != 200:
                raise RuntimeError(
                    f"HuggingFace request failed ({resp.status_code}): {resp.text}"
                )
            body = resp.json()
        else:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=120) as resp:
                    body = json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as e:
                error_body = e.read().decode("utf-8", errors="replace")
                raise RuntimeError(
                    f"HuggingFace request failed ({e.code}): {error_body}"
                ) from e

        return body["choices"][0]["message"]["content"]

    def __repr__(self):
        return f"HuggingFaceLLM(model={self.model!r})"


# ---------------------------------------------------------------------------
# Ollama native
# ---------------------------------------------------------------------------

class OllamaLLM(BaseLLM):
    """Ollama native backend using /api/generate endpoint.

    Uses only stdlib (urllib) — zero SDK dependencies.
    """

    def __init__(
        self,
        model: str = "llama3",
        base_url: str = "http://localhost:11434",
    ):
        self.model = model
        self.base_url = base_url.rstrip("/")

    def generate(self, prompt: str) -> str:
        url = f"{self.base_url}/api/generate"

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
        }

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "TreeDex/0.1",
        }

        if _requests is not None:
            resp = _requests.post(url, json=payload, headers=headers, timeout=120)
            if resp.status_code != 200:
                raise RuntimeError(
                    f"Ollama request failed ({resp.status_code}): {resp.text}"
                )
            body = resp.json()
        else:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=120) as resp:
                    body = json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as e:
                error_body = e.read().decode("utf-8", errors="replace")
                raise RuntimeError(
                    f"Ollama request failed ({e.code}): {error_body}"
                ) from e

        return body["response"]

    def __repr__(self):
        return f"OllamaLLM(model={self.model!r})"


# ---------------------------------------------------------------------------
# LiteLLM — 100+ providers via one library
# ---------------------------------------------------------------------------

class LiteLLM(BaseLLM):
    """LiteLLM wrapper — supports 100+ LLM providers with one interface.

    pip install litellm

    Uses litellm's unified API. Model format: "provider/model-name"
    Examples:
        LiteLLM("gpt-4o")
        LiteLLM("anthropic/claude-sonnet-4-20250514")
        LiteLLM("groq/llama-3.3-70b-versatile")
        LiteLLM("together_ai/meta-llama/Llama-3-70b-chat-hf")
        LiteLLM("bedrock/anthropic.claude-3-sonnet")
        LiteLLM("vertex_ai/gemini-pro")
    """

    def __init__(self, model: str, api_key: str | None = None, **kwargs):
        self.model = model
        self.api_key = api_key
        self._extra_kwargs = kwargs

    def generate(self, prompt: str) -> str:
        import litellm

        kwargs = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
        }
        if self.api_key:
            kwargs["api_key"] = self.api_key
        kwargs.update(self._extra_kwargs)

        response = litellm.completion(**kwargs)
        return response.choices[0].message.content

    def __repr__(self):
        return f"LiteLLM(model={self.model!r})"


# ---------------------------------------------------------------------------
# FunctionLLM — wrap any callable
# ---------------------------------------------------------------------------

class FunctionLLM(BaseLLM):
    """Wrap any callable as an LLM backend.

    Usage:
        # Simple function
        llm = FunctionLLM(lambda prompt: my_api(prompt))

        # Existing function
        def call_my_model(prompt: str) -> str:
            return requests.post(url, json={"prompt": prompt}).json()["text"]

        llm = FunctionLLM(call_my_model)

        # Then use with TreeDex
        index = TreeDex.from_file("doc.pdf", llm=llm)
    """

    def __init__(self, fn):
        if not callable(fn):
            raise TypeError(f"Expected a callable, got {type(fn).__name__}")
        self._fn = fn

    def generate(self, prompt: str) -> str:
        result = self._fn(prompt)
        if not isinstance(result, str):
            raise TypeError(
                f"LLM function must return str, got {type(result).__name__}"
            )
        return result

    def __repr__(self):
        name = getattr(self._fn, "__name__", "anonymous")
        return f"FunctionLLM(fn={name})"
