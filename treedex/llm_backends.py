"""LLM backends for TreeDex.

Named providers (Gemini, OpenAI, Claude) lazy-import their SDKs.
OpenAICompatibleLLM and OllamaLLM use only stdlib (urllib).
"""

import json
import urllib.request
import urllib.error
from abc import ABC, abstractmethod


class BaseLLM(ABC):
    """Base class for all LLM backends."""

    @abstractmethod
    def generate(self, prompt: str) -> str:
        """Send a prompt and return the generated text."""

    def __repr__(self):
        return f"{self.__class__.__name__}()"


class GeminiLLM(BaseLLM):
    """Google Gemini via google-generativeai SDK."""

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
    """OpenAI via openai SDK."""

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
    """Anthropic Claude via anthropic SDK."""

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


class OpenAICompatibleLLM(BaseLLM):
    """Universal backend for any OpenAI-compatible API endpoint.

    Works with: Groq, Together AI, Fireworks, vLLM, LM Studio,
    OpenRouter, Ollama (OpenAI mode), and any other compatible service.

    Uses only stdlib (urllib) — zero SDK dependencies.
    """

    def __init__(
        self,
        base_url: str,
        model: str,
        api_key: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key
        self.max_tokens = max_tokens
        self.temperature = temperature

    def generate(self, prompt: str) -> str:
        url = f"{self.base_url}/chat/completions"

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
        }

        data = json.dumps(payload).encode("utf-8")

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

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

        data = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}

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
