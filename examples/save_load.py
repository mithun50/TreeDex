"""Example: Save and load TreeDex indexes.

Build once, query forever — save the index to JSON and
reload it without re-processing the document.
"""

import os
import sys

from treedex import TreeDex, GeminiLLM


def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Set GEMINI_API_KEY environment variable")
        sys.exit(1)

    llm = GeminiLLM(api_key=api_key)
    index_path = "saved_index.json"

    # Build or load
    if os.path.exists(index_path):
        print(f"Loading existing index from {index_path}...")
        index = TreeDex.load(index_path, llm=llm)
    else:
        if len(sys.argv) < 2:
            print("Usage: python save_load.py <path-to-pdf>")
            print("       (On first run, pass a PDF to build the index)")
            sys.exit(1)

        print(f"Building index from {sys.argv[1]}...")
        index = TreeDex.from_file(sys.argv[1], llm=llm)
        index.save(index_path)
        print(f"Saved to {index_path}")

    # Show stats
    stats = index.stats()
    print(f"\nIndex: {stats['total_nodes']} nodes, "
          f"{stats['total_pages']} pages, "
          f"{stats['total_tokens']:,} tokens")

    # Query
    result = index.query("What are the key topics?")
    print(f"\nQuery result: {result.pages_str}")
    print(f"Context preview: {result.context[:300]}...")


if __name__ == "__main__":
    main()
