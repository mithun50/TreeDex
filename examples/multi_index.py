"""Example: Query multiple TreeDex indexes simultaneously.

Demonstrates building separate indexes for multiple documents and querying
them all at once with TreeDex.query_all().
"""

import os

from treedex import TreeDex, GeminiLLM


def main():
    llm = GeminiLLM(api_key=os.environ["GEMINI_API_KEY"])

    # --- Build indexes for multiple documents ---
    print("Building indexes...")
    index_a = TreeDex.from_file("manual_a.pdf", llm=llm)
    index_b = TreeDex.from_file("manual_b.pdf", llm=llm)
    index_c = TreeDex.from_file("manual_c.pdf", llm=llm)

    # Optionally save and reload later
    index_a.save("manual_a.json")
    index_b.save("manual_b.json")
    index_c.save("manual_c.json")

    # --- Query all indexes at once ---
    question = "What are the safety guidelines?"

    print(f"\nQuerying all indexes: '{question}'")
    multi = TreeDex.query_all(
        [index_a, index_b, index_c],
        question,
        labels=["Manual A", "Manual B", "Manual C"],
    )

    # Inspect per-index results
    for i, result in enumerate(multi.results):
        print(f"\n[{multi.labels[i]}]")
        print(f"  Nodes:   {result.node_ids}")
        print(f"  Pages:   {result.pages_str}")
        print(f"  Reason:  {result.reasoning}")

    # Combined context with [Manual A] / [Manual B] / [Manual C] headers
    print("\n--- Combined Context ---")
    print(multi.combined_context[:500], "...")

    # --- Agentic mode: one answer across all documents ---
    print("\nQuerying with agentic answer...")
    multi_agentic = TreeDex.query_all(
        [index_a, index_b, index_c],
        question,
        labels=["Manual A", "Manual B", "Manual C"],
        agentic=True,
    )
    print(f"\nAnswer:\n{multi_agentic.answer}")


if __name__ == "__main__":
    main()
