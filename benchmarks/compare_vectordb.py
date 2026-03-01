"""Compare TreeDex vs Vector DB (ChromaDB) vs Naive Chunking.

Runs a real retrieval comparison on the example index using:
- TreeDex: tree-based node lookup
- ChromaDB: vector similarity search with default embeddings
- Naive: fixed-size text chunks with TF-IDF similarity

Usage:
    python benchmarks/compare_vectordb.py --json comparison_results.json
"""

import argparse
import json
import math
import os
import re
import sys
import time
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

REPO_ROOT = os.path.join(os.path.dirname(__file__), "..")
EXAMPLE_INDEX = os.path.join(REPO_ROOT, "examples", "my_index.json")

# Ground truth: query -> expected page ranges (from the real index)
QUERIES = [
    {
        "query": "What is displacement current?",
        "expected_pages": [1, 2, 3],
        "expected_node": "0003",
    },
    {
        "query": "What are the sources of electromagnetic waves?",
        "expected_pages": [4],
        "expected_node": "0005",
    },
    {
        "query": "What is the nature of electromagnetic waves?",
        "expected_pages": [5, 6],
        "expected_node": "0006",
    },
    {
        "query": "Describe the electromagnetic spectrum overview",
        "expected_pages": [7, 8, 9, 10],
        "expected_node": "0007",
    },
    {
        "query": "How do radio waves work and what are their frequencies?",
        "expected_pages": [8],
        "expected_node": "0008",
    },
    {
        "query": "What are microwaves used for?",
        "expected_pages": [8],
        "expected_node": "0009",
    },
    {
        "query": "Explain infrared waves and heat radiation",
        "expected_pages": [9],
        "expected_node": "0010",
    },
    {
        "query": "What are X-rays and their medical applications?",
        "expected_pages": [10],
        "expected_node": "0013",
    },
    {
        "query": "What are gamma rays and nuclear radiation?",
        "expected_pages": [10],
        "expected_node": "0014",
    },
    {
        "query": "Maxwell equations and electromagnetic wave introduction",
        "expected_pages": [0],
        "expected_node": "0002",
    },
]


def load_index():
    with open(EXAMPLE_INDEX) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# TF-IDF helper (no external deps)
# ---------------------------------------------------------------------------

def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def compute_tfidf(docs: list[str]) -> tuple[list[dict], dict]:
    """Simple TF-IDF. Returns (tf_vectors, idf_dict)."""
    n = len(docs)
    df = Counter()
    tf_list = []

    for doc in docs:
        tokens = tokenize(doc)
        tf = Counter(tokens)
        total = len(tokens) or 1
        tf_norm = {t: c / total for t, c in tf.items()}
        tf_list.append(tf_norm)
        for t in set(tokens):
            df[t] += 1

    idf = {t: math.log(n / (1 + count)) for t, count in df.items()}
    return tf_list, idf


def tfidf_similarity(query: str, tf_list: list[dict], idf: dict) -> list[float]:
    """Cosine-like similarity between query and each document."""
    q_tokens = tokenize(query)
    q_tf = Counter(q_tokens)
    q_total = len(q_tokens) or 1
    q_vec = {t: (c / q_total) * idf.get(t, 0) for t, c in q_tf.items()}

    scores = []
    for doc_tf in tf_list:
        doc_vec = {t: tf * idf.get(t, 0) for t, tf in doc_tf.items()}
        # Dot product
        dot = sum(q_vec.get(t, 0) * doc_vec.get(t, 0) for t in set(q_vec) | set(doc_vec))
        mag_q = math.sqrt(sum(v * v for v in q_vec.values())) or 1
        mag_d = math.sqrt(sum(v * v for v in doc_vec.values())) or 1
        scores.append(dot / (mag_q * mag_d))
    return scores


# ---------------------------------------------------------------------------
# TreeDex retrieval (structure-based)
# ---------------------------------------------------------------------------

def bench_treedex(data: dict) -> dict:
    """TreeDex retrieval using node structure."""
    from treedex.tree_utils import create_node_mapping

    tree = data["tree"]
    node_map = create_node_mapping(tree)

    # Build page -> node_id mapping
    page_to_nodes = {}
    for nid, node in node_map.items():
        start = node.get("start_index", 0)
        end = node.get("end_index", 0)
        for p in range(start, end + 1):
            page_to_nodes.setdefault(p, []).append(nid)

    # Build node text for TF-IDF matching (simulates LLM retrieval)
    node_ids = list(node_map.keys())
    node_texts = []
    for nid in node_ids:
        n = node_map[nid]
        title = n.get("title", "")
        text = n.get("text", "")
        node_texts.append(f"{title} {text}")

    tf_list, idf = compute_tfidf(node_texts)

    start_time = time.perf_counter()
    hits = 0
    page_hits = 0
    total_pages_expected = 0
    results = []

    for q in QUERIES:
        scores = tfidf_similarity(q["query"], tf_list, idf)
        best_idx = max(range(len(scores)), key=lambda i: scores[i])
        retrieved_nid = node_ids[best_idx]
        retrieved_node = node_map[retrieved_nid]
        retrieved_pages = set(range(
            retrieved_node.get("start_index", 0),
            retrieved_node.get("end_index", 0) + 1,
        ))

        expected_pages = set(q["expected_pages"])
        overlap = len(retrieved_pages & expected_pages)
        total_pages_expected += len(expected_pages)
        page_hits += overlap

        node_hit = 1 if retrieved_nid == q["expected_node"] else 0
        hits += node_hit

        results.append({
            "query": q["query"],
            "expected_node": q["expected_node"],
            "retrieved_node": retrieved_nid,
            "node_match": bool(node_hit),
            "page_overlap": overlap,
            "expected_pages": sorted(expected_pages),
            "retrieved_pages": sorted(retrieved_pages),
        })

    elapsed = time.perf_counter() - start_time

    # Index size = the JSON tree (no page text)
    tree_only = json.dumps(data["tree"]).encode()
    index_size = len(tree_only)

    return {
        "method": "TreeDex",
        "node_accuracy": hits / len(QUERIES),
        "page_recall": page_hits / total_pages_expected if total_pages_expected else 0,
        "query_time_ms": elapsed * 1000,
        "index_size_kb": round(index_size / 1024, 1),
        "queries": len(QUERIES),
        "details": results,
    }


# ---------------------------------------------------------------------------
# ChromaDB vector retrieval
# ---------------------------------------------------------------------------

def bench_chromadb(data: dict) -> dict:
    """ChromaDB vector similarity retrieval."""
    import chromadb

    pages = data["pages"]

    client = chromadb.Client()
    collection = client.create_collection("bench_test")

    # Index each page as a document
    docs = []
    ids = []
    metadatas = []
    for p in pages:
        docs.append(p["text"])
        ids.append(f"page_{p['page_num']}")
        metadatas.append({"page_num": p["page_num"]})

    start_build = time.perf_counter()
    collection.add(documents=docs, ids=ids, metadatas=metadatas)
    build_time = time.perf_counter() - start_build

    start_query = time.perf_counter()
    hits = 0
    page_hits = 0
    total_pages_expected = 0
    results = []

    for q in QUERIES:
        # Retrieve top-3 pages
        result = collection.query(query_texts=[q["query"]], n_results=3)
        retrieved_pages = set()
        for meta in result["metadatas"][0]:
            retrieved_pages.add(meta["page_num"])

        expected_pages = set(q["expected_pages"])
        overlap = len(retrieved_pages & expected_pages)
        total_pages_expected += len(expected_pages)
        page_hits += overlap

        # Count as hit if any expected page is in top-3
        hit = 1 if overlap > 0 else 0
        hits += hit

        results.append({
            "query": q["query"],
            "expected_pages": sorted(expected_pages),
            "retrieved_pages": sorted(retrieved_pages),
            "hit": bool(hit),
            "page_overlap": overlap,
        })

    query_time = time.perf_counter() - start_query

    # Estimate index size (embeddings are in memory, estimate from collection)
    # ChromaDB default embedding dim = 384, float32 = 4 bytes per dim
    n_docs = len(pages)
    embed_dim = 384
    estimated_size = n_docs * embed_dim * 4 + sum(len(p["text"].encode()) for p in pages)

    # Cleanup
    client.delete_collection("bench_test")

    return {
        "method": "ChromaDB (Vector)",
        "hit_rate": hits / len(QUERIES),
        "page_recall": page_hits / total_pages_expected if total_pages_expected else 0,
        "build_time_ms": build_time * 1000,
        "query_time_ms": query_time * 1000,
        "index_size_kb": round(estimated_size / 1024, 1),
        "queries": len(QUERIES),
        "details": results,
    }


# ---------------------------------------------------------------------------
# Naive chunking retrieval (TF-IDF)
# ---------------------------------------------------------------------------

def bench_naive(data: dict) -> dict:
    """Naive fixed-size chunking with TF-IDF retrieval."""
    pages = data["pages"]

    # Merge all text and chunk into ~500 char pieces
    all_text = ""
    page_boundaries = []
    for p in pages:
        start_char = len(all_text)
        all_text += p["text"] + "\n"
        end_char = len(all_text)
        page_boundaries.append((p["page_num"], start_char, end_char))

    chunk_size = 500
    chunks = []
    chunk_pages = []  # which pages each chunk covers
    for i in range(0, len(all_text), chunk_size):
        chunk_text = all_text[i : i + chunk_size]
        chunks.append(chunk_text)
        # Find which pages this chunk spans
        pages_in_chunk = set()
        for pnum, pstart, pend in page_boundaries:
            if i < pend and i + chunk_size > pstart:
                pages_in_chunk.add(pnum)
        chunk_pages.append(pages_in_chunk)

    tf_list, idf = compute_tfidf(chunks)

    start_time = time.perf_counter()
    hits = 0
    page_hits = 0
    total_pages_expected = 0
    results = []

    for q in QUERIES:
        scores = tfidf_similarity(q["query"], tf_list, idf)
        # Get top-3 chunks
        top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:3]
        retrieved_pages = set()
        for idx in top_indices:
            retrieved_pages.update(chunk_pages[idx])

        expected_pages = set(q["expected_pages"])
        overlap = len(retrieved_pages & expected_pages)
        total_pages_expected += len(expected_pages)
        page_hits += overlap

        hit = 1 if overlap > 0 else 0
        hits += hit

        results.append({
            "query": q["query"],
            "expected_pages": sorted(expected_pages),
            "retrieved_pages": sorted(retrieved_pages),
            "hit": bool(hit),
            "page_overlap": overlap,
        })

    query_time = time.perf_counter() - start_time
    index_size = sum(len(c.encode()) for c in chunks)

    return {
        "method": "Naive Chunking (TF-IDF)",
        "hit_rate": hits / len(QUERIES),
        "page_recall": page_hits / total_pages_expected if total_pages_expected else 0,
        "query_time_ms": query_time * 1000,
        "index_size_kb": round(index_size / 1024, 1),
        "n_chunks": len(chunks),
        "chunk_size": chunk_size,
        "queries": len(QUERIES),
        "details": results,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run_comparison() -> dict:
    print("=" * 60)
    print("TreeDex vs Vector DB vs Naive Chunking")
    print("=" * 60)

    data = load_index()
    n_pages = len(data["pages"])
    print(f"\nDocument: Electromagnetic Waves ({n_pages} pages)")

    # TreeDex
    print("\n--- TreeDex ---")
    td = bench_treedex(data)
    print(f"  Node accuracy:  {td['node_accuracy']:.0%}")
    print(f"  Page recall:    {td['page_recall']:.0%}")
    print(f"  Query time:     {td['query_time_ms']:.1f} ms")
    print(f"  Index size:     {td['index_size_kb']} KB")

    # ChromaDB
    print("\n--- ChromaDB (Vector DB) ---")
    try:
        chroma = bench_chromadb(data)
        print(f"  Hit rate:       {chroma['hit_rate']:.0%}")
        print(f"  Page recall:    {chroma['page_recall']:.0%}")
        print(f"  Build time:     {chroma['build_time_ms']:.1f} ms")
        print(f"  Query time:     {chroma['query_time_ms']:.1f} ms")
        print(f"  Index size:     {chroma['index_size_kb']} KB")
    except ImportError:
        print("  SKIPPED (chromadb not installed)")
        chroma = {
            "method": "ChromaDB (Vector)",
            "hit_rate": None,
            "page_recall": None,
            "query_time_ms": None,
            "index_size_kb": None,
            "note": "chromadb not installed",
        }

    # Naive
    print("\n--- Naive Chunking (TF-IDF) ---")
    naive = bench_naive(data)
    print(f"  Hit rate:       {naive['hit_rate']:.0%}")
    print(f"  Page recall:    {naive['page_recall']:.0%}")
    print(f"  Query time:     {naive['query_time_ms']:.1f} ms")
    print(f"  Index size:     {naive['index_size_kb']} KB")
    print(f"  Chunks:         {naive['n_chunks']}")

    # Summary
    print("\n" + "=" * 60)
    print("Comparison Summary")
    print("=" * 60)
    print(f"{'Method':<30} {'Accuracy':<12} {'Recall':<12} {'Index Size':<12}")
    print("-" * 66)
    print(f"{'TreeDex':<30} {td['node_accuracy']:.0%}{'':<9} {td['page_recall']:.0%}{'':<9} {td['index_size_kb']} KB")
    if chroma.get("hit_rate") is not None:
        print(f"{'ChromaDB (Vector)':<30} {chroma['hit_rate']:.0%}{'':<9} {chroma['page_recall']:.0%}{'':<9} {chroma['index_size_kb']} KB")
    print(f"{'Naive Chunking':<30} {naive['hit_rate']:.0%}{'':<9} {naive['page_recall']:.0%}{'':<9} {naive['index_size_kb']} KB")
    print()

    return {
        "document": f"Electromagnetic Waves ({n_pages} pages)",
        "queries": len(QUERIES),
        "treedex": td,
        "chromadb": chroma,
        "naive": naive,
    }


def main():
    parser = argparse.ArgumentParser(description="TreeDex vs Vector DB Comparison")
    parser.add_argument("--json", help="Save results to JSON file")
    args = parser.parse_args()

    results = run_comparison()

    if args.json:
        with open(args.json, "w") as f:
            json.dump(results, f, indent=2, default=str)
        print(f"Results saved to {args.json}")


if __name__ == "__main__":
    main()
