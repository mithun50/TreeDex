"""Example: Using multiple LLM providers with TreeDex.

Demonstrates how to build an index with one provider
and query it with another.
"""

import os

from treedex import TreeDex, GeminiLLM, GroqLLM, OpenAICompatibleLLM


def main():
    # --- Provider 1: Build index with Gemini ---
    gemini = GeminiLLM(
        api_key=os.environ["GEMINI_API_KEY"],
    )

    print("Building index with Gemini...")
    index = TreeDex.from_file("document.pdf", llm=gemini)
    index.save("my_index.json")

    # --- Provider 2: Query with Groq (fast inference) ---
    groq = GroqLLM(
        api_key=os.environ["GROQ_API_KEY"],
        model="llama-3.3-70b-versatile",
    )

    print("\nQuerying with Groq...")
    result = index.query("What are the main findings?", llm=groq)
    print(f"  Nodes: {result.node_ids}")
    print(f"  Pages: {result.pages_str}")

    # --- Provider 3: Query with any OpenAI-compatible endpoint ---
    custom = OpenAICompatibleLLM(
        base_url="https://api.together.xyz/v1",
        api_key=os.environ.get("TOGETHER_API_KEY", ""),
        model="meta-llama/Llama-3-70b-chat-hf",
    )

    print("\nQuerying with Together AI...")
    result2 = index.query("Summarize the methodology.", llm=custom)
    print(f"  Nodes: {result2.node_ids}")
    print(f"  Pages: {result2.pages_str}")


if __name__ == "__main__":
    main()
