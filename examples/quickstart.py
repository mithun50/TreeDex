"""TreeDex Quick Start Example.

Usage:
    pip install treedex
    export GEMINI_API_KEY="your-key"
    python examples/quickstart.py path/to/document.pdf
"""

import os
import sys

from treedex import TreeDex, GeminiLLM


def main():
    if len(sys.argv) < 2:
        print("Usage: python quickstart.py <path-to-pdf>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Set GEMINI_API_KEY environment variable")
        sys.exit(1)

    # 1. Create LLM backend
    llm = GeminiLLM(api_key=api_key)

    # 2. Build index
    print(f"Indexing: {pdf_path}")
    index = TreeDex.from_file(pdf_path, llm=llm)

    # 3. Show structure
    print("\n--- Document Structure ---")
    index.show_tree()

    # 4. Show stats
    print("\n--- Stats ---")
    for k, v in index.stats().items():
        print(f"  {k}: {v}")

    # 5. Interactive query loop
    print("\n--- Query Mode (type 'quit' to exit) ---")
    while True:
        question = input("\nQuestion: ").strip()
        if question.lower() in ("quit", "exit", "q"):
            break

        result = index.query(question)
        print(f"\nSource: {result.pages_str}")
        print(f"Reasoning: {result.reasoning}")
        print(f"\nContext:\n{result.context[:1000]}")


if __name__ == "__main__":
    main()
