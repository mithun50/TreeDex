"""Tests for treedex.llm_backends module."""

import json
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

import pytest

from treedex.llm_backends import (
    BaseLLM,
    FunctionLLM,
    OpenAICompatibleLLM,
    GroqLLM,
    TogetherLLM,
    FireworksLLM,
    OpenRouterLLM,
    DeepSeekLLM,
    CerebrasLLM,
    SambanovaLLM,
    OllamaLLM,
)


# ---------------------------------------------------------------------------
# Mock HTTP server for testing OpenAI-compatible and Ollama backends
# ---------------------------------------------------------------------------

class _MockHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}

        if "/chat/completions" in self.path:
            response = {
                "choices": [{
                    "message": {
                        "content": f"mock response for: {body.get('model', 'unknown')}"
                    }
                }]
            }
        elif "/api/generate" in self.path:
            response = {
                "response": f"ollama mock for: {body.get('model', 'unknown')}"
            }
        else:
            self.send_response(404)
            self.end_headers()
            return

        payload = json.dumps(response).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format, *args):
        pass  # suppress logs


@pytest.fixture(scope="module")
def mock_server():
    server = HTTPServer(("127.0.0.1", 0), _MockHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{port}"
    server.shutdown()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestBaseLLM:
    def test_cannot_instantiate(self):
        with pytest.raises(TypeError):
            BaseLLM()

    def test_subclass_works(self):
        class MyLLM(BaseLLM):
            def generate(self, prompt: str) -> str:
                return f"echo: {prompt}"

        llm = MyLLM()
        assert llm.generate("hello") == "echo: hello"
        assert "MyLLM" in repr(llm)


class TestFunctionLLM:
    def test_basic(self):
        llm = FunctionLLM(lambda p: p.upper())
        assert llm.generate("hello") == "HELLO"

    def test_non_callable_raises(self):
        with pytest.raises(TypeError, match="Expected a callable"):
            FunctionLLM("not a function")

    def test_non_string_return_raises(self):
        llm = FunctionLLM(lambda p: 42)
        with pytest.raises(TypeError, match="must return str"):
            llm.generate("test")

    def test_repr(self):
        def my_func(p):
            return p

        llm = FunctionLLM(my_func)
        assert "my_func" in repr(llm)


class TestOpenAICompatibleLLM:
    def test_generate(self, mock_server):
        llm = OpenAICompatibleLLM(
            base_url=f"{mock_server}/v1",
            model="test-model",
        )
        result = llm.generate("test prompt")
        assert "test-model" in result

    def test_with_api_key(self, mock_server):
        llm = OpenAICompatibleLLM(
            base_url=f"{mock_server}/v1",
            model="test-model",
            api_key="sk-test",
        )
        result = llm.generate("test")
        assert "mock response" in result

    def test_repr(self):
        llm = OpenAICompatibleLLM(
            base_url="https://api.example.com/v1",
            model="my-model",
        )
        assert "api.example.com" in repr(llm)
        assert "my-model" in repr(llm)


class TestConvenienceWrappers:
    """Test that convenience wrappers set the correct base_url."""

    def test_groq_url(self):
        llm = GroqLLM(api_key="test")
        assert "groq.com" in llm.base_url

    def test_together_url(self):
        llm = TogetherLLM(api_key="test")
        assert "together.xyz" in llm.base_url

    def test_fireworks_url(self):
        llm = FireworksLLM(api_key="test")
        assert "fireworks.ai" in llm.base_url

    def test_openrouter_url(self):
        llm = OpenRouterLLM(api_key="test")
        assert "openrouter.ai" in llm.base_url

    def test_deepseek_url(self):
        llm = DeepSeekLLM(api_key="test")
        assert "deepseek.com" in llm.base_url

    def test_cerebras_url(self):
        llm = CerebrasLLM(api_key="test")
        assert "cerebras.ai" in llm.base_url

    def test_sambanova_url(self):
        llm = SambanovaLLM(api_key="test")
        assert "sambanova.ai" in llm.base_url

    def test_wrappers_inherit_generate(self, mock_server):
        """All wrappers can call generate via the parent class."""
        llm = GroqLLM(api_key="test")
        # Override base_url to use mock
        llm.base_url = f"{mock_server}/v1"
        result = llm.generate("test")
        assert "mock response" in result


class TestOllamaLLM:
    def test_generate(self, mock_server):
        llm = OllamaLLM(model="test-model", base_url=mock_server)
        result = llm.generate("test prompt")
        assert "test-model" in result

    def test_repr(self):
        llm = OllamaLLM(model="llama3")
        assert "llama3" in repr(llm)
