"""Example: Creating a custom LLM backend.

Shows three ways to integrate any LLM with TreeDex:
1. FunctionLLM — wrap a callable
2. BaseLLM subclass — full control
3. LiteLLM — 100+ providers
"""

from treedex import TreeDex, BaseLLM, FunctionLLM


# --- Method 1: FunctionLLM ---
# Wrap any function that takes str and returns str.

def my_api_call(prompt: str) -> str:
    """Simulate an API call."""
    # Replace with your actual API call
    import urllib.request
    import json

    data = json.dumps({
        "model": "my-model",
        "messages": [{"role": "user", "content": prompt}],
    }).encode()

    req = urllib.request.Request(
        "https://my-api.example.com/v1/chat/completions",
        data=data,
        headers={"Content-Type": "application/json"},
    )

    with urllib.request.urlopen(req) as resp:
        body = json.loads(resp.read())

    return body["choices"][0]["message"]["content"]


# llm = FunctionLLM(my_api_call)


# --- Method 2: BaseLLM subclass ---
# Full control over initialization and generation.

class MyCustomLLM(BaseLLM):
    """Custom LLM that connects to your proprietary API."""

    def __init__(self, endpoint: str, token: str):
        self.endpoint = endpoint
        self.token = token

    def generate(self, prompt: str) -> str:
        import urllib.request
        import json

        data = json.dumps({"prompt": prompt}).encode()
        req = urllib.request.Request(
            self.endpoint,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.token}",
            },
        )

        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())["text"]


# llm = MyCustomLLM(endpoint="https://...", token="...")


# --- Method 3: Lambda (simplest) ---
# For quick prototyping.

# llm = FunctionLLM(lambda p: openai.chat(p))


# --- Usage ---
# index = TreeDex.from_file("doc.pdf", llm=llm)
# result = index.query("What is the main argument?")

print("See the code for three ways to create custom LLM backends!")
print("1. FunctionLLM(my_function)")
print("2. class MyLLM(BaseLLM): ...")
print("3. FunctionLLM(lambda p: ...)")
