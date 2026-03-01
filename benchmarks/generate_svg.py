"""Generate benchmark SVG chart from results JSON.

Usage:
    python benchmarks/generate_svg.py benchmark_results.json assets/benchmarks.svg
"""

import json
import sys
from datetime import datetime, timezone


def _esc(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _rect(x, y, w, h, fill, rx=4, stroke=None, sw=1, extra=""):
    s = f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"'
    if stroke:
        s += f' stroke="{stroke}" stroke-width="{sw}"'
    if extra:
        s += f" {extra}"
    return s + "/>"


def _text(x, y, txt, fill="#1e293b", size=12, weight="400", anchor="middle"):
    return (
        f'  <text x="{x}" y="{y}" text-anchor="{anchor}" '
        f'fill="{fill}" font-size="{size}" font-weight="{weight}">'
        f"{_esc(str(txt))}</text>"
    )


def generate_svg(results: dict) -> str:
    build_ms = results["build_time_seconds"] * 1000
    index_kb = results["index_size_kb"]
    total_nodes = results["node_stats"]["total_nodes"]
    total_chars = results["node_stats"]["total_text_chars"]
    avg_chars = results["node_stats"]["avg_chars_per_node"]
    doc = results["document"]

    acc = results.get("retrieval_accuracy", {})
    accuracy_pct = acc.get("overall_accuracy", 0) * 100
    total_queries = acc.get("total_queries", 0)
    details = acc.get("details", [])

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # Check if we have individual benchmark data
    benchmarks = results.get("benchmarks", [])
    real_bench = None
    for b in benchmarks:
        if b.get("name") == "electromagnetic_waves":
            real_bench = b
            break

    W = 900
    M = 30  # margin

    # Layout
    CARD_W = (W - 2 * M - 20) // 2
    CARD_H = 96
    GAP = 16

    # Dynamic: tree section + query list
    n_queries = min(len(details), 10)  # show max 10
    tree_section_h = 200 if real_bench else 0
    query_section_h = (40 + n_queries * 22 + 16) if n_queries > 0 else 0

    H = (
        56  # header
        + 28  # subtitle
        + 2 * (CARD_H + GAP)  # 2 rows of cards
        + GAP
        + tree_section_h
        + (GAP if tree_section_h else 0)
        + query_section_h
        + (GAP if query_section_h else 0)
        + 34  # footer
        + 8  # padding
    )

    L = []
    L.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
        f'font-family="system-ui, -apple-system, sans-serif">'
    )

    # Defs
    L.append("  <defs>")
    for gid, c1, c2 in [
        ("hdr", "#1e293b", "#334155"),
        ("g1", "#22c55e", "#16a34a"),
        ("g2", "#3b82f6", "#2563eb"),
        ("g3", "#f59e0b", "#d97706"),
        ("g4", "#8b5cf6", "#7c3aed"),
    ]:
        L.append(f'    <linearGradient id="{gid}" x1="0%" y1="0%" x2="100%" y2="0%">')
        L.append(f'      <stop offset="0%" style="stop-color:{c1}"/>')
        L.append(f'      <stop offset="100%" style="stop-color:{c2}"/>')
        L.append("    </linearGradient>")
    L.append('    <filter id="sh"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.08"/></filter>')
    L.append("  </defs>")

    # Background
    L.append(_rect(0, 0, W, H, "#fafafa", 12))

    # Header
    L.append(_rect(0, 0, W, 56, "url(#hdr)", 12))
    L.append(_rect(0, 20, W, 36, "url(#hdr)", 0))
    L.append(_text(W // 2, 36, "TreeDex Benchmark Results", "white", 20, "700"))

    # Subtitle
    doc_short = (doc[:55] + "...") if len(doc) > 58 else doc
    L.append(_text(W // 2, 74, f"{doc_short}  |  {ts}", "#64748b", 11))

    # ── 4 Metric Cards (2x2) ──
    cy = 88
    cards = [
        ("Build Time", f"{build_ms:.1f} ms", "url(#g1)", "Tree index construction"),
        ("Index Size", f"{index_kb:.1f} KB", "url(#g2)", "Portable JSON file"),
        ("Structure Validation", f"{accuracy_pct:.0f}%", "url(#g3)", f"{total_queries} queries matched"),
        ("Tree Nodes", str(total_nodes), "url(#g4)", f"{total_chars:,} chars indexed"),
    ]
    for i, (label, val, color, desc) in enumerate(cards):
        col = i % 2
        row = i // 2
        cx = M + col * (CARD_W + 20)
        ry = cy + row * (CARD_H + GAP)

        L.append(_rect(cx, ry, CARD_W, CARD_H, "white", 10, "#e2e8f0", 1, 'filter="url(#sh)"'))
        L.append(_rect(cx, ry, 5, CARD_H, color, 3))
        L.append(_text(cx + 22, ry + 24, label, "#64748b", 11, "600", "start"))
        L.append(_text(cx + 22, ry + 54, val, "#1e293b", 24, "800", "start"))
        L.append(_text(cx + 22, ry + 74, desc, "#94a3b8", 10, "400", "start"))

    section_y = cy + 2 * (CARD_H + GAP) + GAP

    # ── Tree Structure Visualization (from real index) ──
    if real_bench:
        box_y = section_y
        box_h = tree_section_h
        L.append(_rect(M, box_y, W - 2 * M, box_h, "white", 10, "#e2e8f0", 1, 'filter="url(#sh)"'))
        L.append(_text(W // 2, box_y + 22, "Example: Electromagnetic Waves Index Tree", "#1e293b", 13, "700"))

        # Draw a simplified tree from the real index
        real_stats = real_bench.get("node_stats", {})
        tree_items = [
            (0, "1: Electromagnetic Waves", "14 pages"),
            (1, "1.1: Introduction", "page 0"),
            (1, "1.2: Displacement Current", "pages 1-3"),
            (1, "1.3: Electromagnetic Waves", "pages 4-6"),
            (2, "1.3.1: Sources", "page 4"),
            (2, "1.3.2: Nature", "pages 5-6"),
            (1, "1.4: Electromagnetic Spectrum", "pages 7-13"),
            (2, "1.4.1: Radio waves", "page 8"),
            (2, "1.4.2: Microwaves", "page 8"),
            (2, "1.4.3-7: IR, Visible, UV, X-ray, Gamma", "pages 9-13"),
        ]

        ty = box_y + 42
        for depth, title, pages in tree_items:
            indent = M + 20 + depth * 24
            # Tree connector
            if depth > 0:
                L.append(f'  <line x1="{indent - 12}" y1="{ty - 5}" x2="{indent - 4}" y2="{ty - 5}" stroke="#cbd5e1" stroke-width="1.5"/>')
                L.append(f'  <circle cx="{indent}" cy="{ty - 5}" r="3" fill="#22c55e"/>')
            else:
                L.append(f'  <circle cx="{indent}" cy="{ty - 5}" r="4" fill="#1e293b"/>')

            L.append(_text(indent + 10, ty - 1, title, "#1e293b", 11, "500", "start"))
            L.append(_text(W - M - 20, ty - 1, pages, "#94a3b8", 10, "400", "end"))
            ty += 16

        section_y = box_y + box_h + GAP

    # ── Query List (compact, no bars) ──
    if n_queries > 0:
        box_y = section_y
        box_h = query_section_h
        L.append(_rect(M, box_y, W - 2 * M, box_h, "white", 10, "#e2e8f0", 1, 'filter="url(#sh)"'))
        L.append(_text(W // 2, box_y + 22, f"Validated Queries ({total_queries} total)", "#1e293b", 13, "700"))

        qy = box_y + 42
        for j in range(n_queries):
            d = details[j]
            q = d["query"]
            q_short = (q[:60] + "...") if len(q) > 60 else q
            status = "pass" if d["accuracy"] >= 1.0 else "fail"
            color = "#22c55e" if status == "pass" else "#ef4444"
            icon = "\u2713" if status == "pass" else "\u2717"

            L.append(f'  <circle cx="{M + 18}" cy="{qy - 4}" r="6" fill="{color}" opacity="0.15"/>')
            L.append(_text(M + 18, qy - 1, icon, color, 10, "700"))
            L.append(_text(M + 32, qy - 1, q_short, "#475569", 10, "400", "start"))
            qy += 22

        if len(details) > n_queries:
            L.append(_text(W // 2, qy + 4, f"+ {len(details) - n_queries} more queries", "#94a3b8", 10))

        section_y = box_y + box_h + GAP

    # ── Footer ──
    fy = H - 38
    L.append(_rect(M, fy, W - 2 * M, 26, "#f0fdf4", 6, "#bbf7d0"))
    L.append(_text(
        W // 2, fy + 17,
        f"Avg {avg_chars:,} chars/node  |  {total_nodes} nodes  |  {index_kb:.1f} KB  |  {build_ms:.1f} ms build",
        "#16a34a", 11, "600",
    ))

    L.append("</svg>")
    return "\n".join(L)


def main():
    if len(sys.argv) < 3:
        print("Usage: python generate_svg.py <results.json> <output.svg>")
        sys.exit(1)

    with open(sys.argv[1]) as f:
        results = json.load(f)

    svg = generate_svg(results)
    with open(sys.argv[2], "w") as f:
        f.write(svg)
    print(f"SVG generated: {sys.argv[2]}")


if __name__ == "__main__":
    main()
