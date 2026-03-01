"""Generate benchmark SVG charts from results JSON.

Usage:
    python benchmarks/generate_svg.py benchmark_results.json assets/benchmarks.svg
    python benchmarks/generate_svg.py --comparison comparison_results.json assets/benchmarks.svg
"""

import argparse
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


def _line(x1, y1, x2, y2, stroke="#e2e8f0", sw=1):
    return f'  <line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}"/>'


# ---------------------------------------------------------------------------
# Comparison SVG (TreeDex vs ChromaDB vs Naive)
# ---------------------------------------------------------------------------

def generate_comparison_svg(results: dict) -> str:
    td = results["treedex"]
    chroma = results["chromadb"]
    naive = results["naive"]
    doc = results["document"]
    n_queries = results["queries"]

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    has_chroma = chroma.get("hit_rate") is not None

    W = 900
    M = 30
    H = 680 if has_chroma else 520

    L = []
    L.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
        f'font-family="system-ui, -apple-system, sans-serif">'
    )

    # Defs
    L.append("  <defs>")
    for gid, c1, c2 in [
        ("hdr", "#1e293b", "#334155"),
        ("td", "#22c55e", "#16a34a"),
        ("ch", "#3b82f6", "#2563eb"),
        ("nv", "#94a3b8", "#64748b"),
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
    L.append(_text(W // 2, 36, "TreeDex vs Vector DB vs Naive — Real Benchmark", "white", 18, "700"))

    # Subtitle
    L.append(_text(W // 2, 76, f"{doc}  |  {n_queries} queries  |  {ts}", "#64748b", 11))

    # Legend
    ly = 94
    L.append(_rect(260, ly, 12, 12, "url(#td)", 3))
    L.append(_text(278, ly + 10, "TreeDex", "#1e293b", 11, "600", "start"))
    if has_chroma:
        L.append(_rect(360, ly, 12, 12, "url(#ch)", 3))
        L.append(_text(378, ly + 10, "ChromaDB", "#1e293b", 11, "600", "start"))
    L.append(_rect(470, ly, 12, 12, "url(#nv)", 3))
    L.append(_text(488, ly + 10, "Naive Chunking", "#1e293b", 11, "600", "start"))

    # ── Bar Charts (side by side) ──
    chart_y = 120
    chart_h = 200
    chart_w = (W - 2 * M - 30) // 2

    # Prepare data
    td_recall = td.get("page_recall", 0) * 100
    td_acc = td.get("node_accuracy", 0) * 100
    td_size = td.get("index_size_kb", 0)

    ch_recall = (chroma.get("page_recall", 0) or 0) * 100 if has_chroma else 0
    ch_hit = (chroma.get("hit_rate", 0) or 0) * 100 if has_chroma else 0
    ch_size = (chroma.get("index_size_kb", 0) or 0) if has_chroma else 0

    nv_recall = naive.get("page_recall", 0) * 100
    nv_hit = naive.get("hit_rate", 0) * 100
    nv_size = naive.get("index_size_kb", 0)

    # ── Chart 1: Retrieval Accuracy ──
    cx1 = M
    L.append(_rect(cx1, chart_y, chart_w, chart_h, "white", 10, "#e2e8f0", 1, 'filter="url(#sh)"'))
    L.append(_text(cx1 + chart_w // 2, chart_y + 22, "Page Recall (%)", "#1e293b", 13, "700"))
    L.append(_text(cx1 + chart_w // 2, chart_y + 36, "% of expected pages found in top-3 results", "#94a3b8", 9))

    # Bar area
    bar_area_top = chart_y + 50
    bar_area_h = chart_h - 70
    bar_baseline = bar_area_top + bar_area_h

    # Grid lines
    for pct in [25, 50, 75, 100]:
        gy = bar_baseline - (pct / 100) * bar_area_h
        L.append(_line(cx1 + 40, gy, cx1 + chart_w - 15, gy, "#f1f5f9"))
        L.append(_text(cx1 + 35, gy + 4, f"{pct}", "#94a3b8", 9, "400", "end"))

    L.append(_line(cx1 + 40, bar_baseline, cx1 + chart_w - 15, bar_baseline, "#e2e8f0"))

    n_bars = 3 if has_chroma else 2
    bar_w = 50
    total_bars_w = n_bars * bar_w + (n_bars - 1) * 20
    bar_start_x = cx1 + (chart_w - total_bars_w) // 2

    # TreeDex bar
    bx = bar_start_x
    bh = max((td_recall / 100) * bar_area_h, 2)
    L.append(_rect(bx, bar_baseline - bh, bar_w, bh, "url(#td)", 4))
    L.append(_text(bx + bar_w // 2, bar_baseline - bh - 6, f"{td_recall:.0f}%", "#16a34a", 11, "700"))
    L.append(_text(bx + bar_w // 2, bar_baseline + 14, "TreeDex", "#64748b", 9, "500"))

    # ChromaDB bar
    if has_chroma:
        bx = bar_start_x + bar_w + 20
        bh = max((ch_recall / 100) * bar_area_h, 2)
        L.append(_rect(bx, bar_baseline - bh, bar_w, bh, "url(#ch)", 4))
        L.append(_text(bx + bar_w // 2, bar_baseline - bh - 6, f"{ch_recall:.0f}%", "#2563eb", 11, "700"))
        L.append(_text(bx + bar_w // 2, bar_baseline + 14, "ChromaDB", "#64748b", 9, "500"))

    # Naive bar
    bx = bar_start_x + (bar_w + 20) * (n_bars - 1)
    bh = max((nv_recall / 100) * bar_area_h, 2)
    L.append(_rect(bx, bar_baseline - bh, bar_w, bh, "url(#nv)", 4))
    L.append(_text(bx + bar_w // 2, bar_baseline - bh - 6, f"{nv_recall:.0f}%", "#64748b", 11, "700"))
    L.append(_text(bx + bar_w // 2, bar_baseline + 14, "Naive", "#64748b", 9, "500"))

    # ── Chart 2: Index Size ──
    cx2 = M + chart_w + 30
    L.append(_rect(cx2, chart_y, chart_w, chart_h, "white", 10, "#e2e8f0", 1, 'filter="url(#sh)"'))
    L.append(_text(cx2 + chart_w // 2, chart_y + 22, "Index Size (KB)", "#1e293b", 13, "700"))
    L.append(_text(cx2 + chart_w // 2, chart_y + 36, "Storage required for the index", "#94a3b8", 9))

    max_size = max(td_size, ch_size, nv_size, 1)
    bar_area_top2 = chart_y + 50
    bar_baseline2 = bar_area_top2 + bar_area_h

    # Grid lines
    for frac in [0.25, 0.5, 0.75, 1.0]:
        val = max_size * frac
        gy = bar_baseline2 - frac * bar_area_h
        L.append(_line(cx2 + 50, gy, cx2 + chart_w - 15, gy, "#f1f5f9"))
        L.append(_text(cx2 + 45, gy + 4, f"{val:.0f}", "#94a3b8", 9, "400", "end"))

    L.append(_line(cx2 + 50, bar_baseline2, cx2 + chart_w - 15, bar_baseline2, "#e2e8f0"))

    bar_start_x2 = cx2 + (chart_w - total_bars_w) // 2

    # TreeDex size bar
    bx = bar_start_x2
    bh = max((td_size / max_size) * bar_area_h, 2)
    L.append(_rect(bx, bar_baseline2 - bh, bar_w, bh, "url(#td)", 4))
    L.append(_text(bx + bar_w // 2, bar_baseline2 - bh - 6, f"{td_size:.0f}", "#16a34a", 11, "700"))
    L.append(_text(bx + bar_w // 2, bar_baseline2 + 14, "TreeDex", "#64748b", 9, "500"))

    if has_chroma:
        bx = bar_start_x2 + bar_w + 20
        bh = max((ch_size / max_size) * bar_area_h, 2)
        L.append(_rect(bx, bar_baseline2 - bh, bar_w, bh, "url(#ch)", 4))
        L.append(_text(bx + bar_w // 2, bar_baseline2 - bh - 6, f"{ch_size:.0f}", "#2563eb", 11, "700"))
        L.append(_text(bx + bar_w // 2, bar_baseline2 + 14, "ChromaDB", "#64748b", 9, "500"))

    bx = bar_start_x2 + (bar_w + 20) * (n_bars - 1)
    bh = max((nv_size / max_size) * bar_area_h, 2)
    L.append(_rect(bx, bar_baseline2 - bh, bar_w, bh, "url(#nv)", 4))
    L.append(_text(bx + bar_w // 2, bar_baseline2 - bh - 6, f"{nv_size:.0f}", "#64748b", 11, "700"))
    L.append(_text(bx + bar_w // 2, bar_baseline2 + 14, "Naive", "#64748b", 9, "500"))

    # ── Comparison Table ──
    table_y = chart_y + chart_h + 20
    row_h = 28
    n_data_rows = 5
    table_h = 30 + n_data_rows * row_h + 10
    col_w = (W - 2 * M) // 4

    L.append(_rect(M, table_y, W - 2 * M, table_h, "white", 10, "#e2e8f0", 1, 'filter="url(#sh)"'))

    # Header row
    hry = table_y + 22
    L.append(_text(M + col_w // 2, hry, "Metric", "#64748b", 11, "700"))
    L.append(_text(M + col_w + col_w // 2, hry, "TreeDex", "#16a34a", 11, "700"))
    if has_chroma:
        L.append(_text(M + 2 * col_w + col_w // 2, hry, "ChromaDB", "#2563eb", 11, "700"))
    L.append(_text(M + 3 * col_w + col_w // 2, hry, "Naive", "#64748b", 11, "700"))

    L.append(_line(M + 10, table_y + 30, W - M - 10, table_y + 30, "#e2e8f0"))

    # Data rows
    rows = [
        ("Page Recall", f"{td_recall:.0f}%", f"{ch_recall:.0f}%" if has_chroma else "—", f"{nv_recall:.0f}%"),
        ("Hit Rate (top-3)", f"{td_acc:.0f}%", f"{ch_hit:.0f}%" if has_chroma else "—", f"{nv_hit:.0f}%"),
        ("Index Size", f"{td_size:.1f} KB", f"{ch_size:.0f} KB" if has_chroma else "—", f"{nv_size:.1f} KB"),
        ("Query Time", f"{td['query_time_ms']:.1f} ms", f"{chroma['query_time_ms']:.1f} ms" if has_chroma and chroma.get('query_time_ms') else "—", f"{naive['query_time_ms']:.1f} ms"),
        ("Page Attribution", "Exact", "Approximate", "None"),
    ]

    for i, (metric, v_td, v_ch, v_nv) in enumerate(rows):
        ry = table_y + 30 + 6 + i * row_h + row_h // 2 + 4

        # Alternate row bg
        if i % 2 == 0:
            L.append(_rect(M + 4, table_y + 30 + 4 + i * row_h, W - 2 * M - 8, row_h, "#f8fafc", 4))

        L.append(_text(M + col_w // 2, ry, metric, "#475569", 11, "500"))
        L.append(_text(M + col_w + col_w // 2, ry, v_td, "#16a34a", 11, "700"))
        L.append(_text(M + 2 * col_w + col_w // 2, ry, v_ch, "#2563eb" if has_chroma else "#94a3b8", 11, "600" if has_chroma else "400"))
        L.append(_text(M + 3 * col_w + col_w // 2, ry, v_nv, "#64748b", 11, "500"))

    # ── Per-query breakdown ──
    pq_y = table_y + table_h + 16
    n_show = min(len(td.get("details", [])), 10)
    pq_h = 32 + n_show * 20 + 8

    if n_show > 0:
        L.append(_rect(M, pq_y, W - 2 * M, pq_h, "white", 10, "#e2e8f0", 1, 'filter="url(#sh)"'))
        L.append(_text(W // 2, pq_y + 22, "Per-Query Results", "#1e293b", 13, "700"))

        td_details = td.get("details", [])
        ch_details = chroma.get("details", []) if has_chroma else []
        nv_details = naive.get("details", [])

        qy = pq_y + 38
        for j in range(n_show):
            q = td_details[j]["query"]
            q_short = (q[:35] + "...") if len(q) > 35 else q

            td_ok = td_details[j].get("node_match", False)
            ch_ok = ch_details[j].get("hit", False) if j < len(ch_details) else False
            nv_ok = nv_details[j].get("hit", False) if j < len(nv_details) else False

            L.append(_text(M + 16, qy, q_short, "#475569", 10, "400", "start"))

            # Status dots
            dot_x = 560
            # TreeDex
            c = "#22c55e" if td_ok else "#ef4444"
            L.append(f'  <circle cx="{dot_x}" cy="{qy - 3}" r="5" fill="{c}"/>')
            L.append(_text(dot_x, qy, "\u2713" if td_ok else "\u2717", "white", 7, "700"))

            # ChromaDB
            if has_chroma:
                c = "#3b82f6" if ch_ok else "#ef4444"
                L.append(f'  <circle cx="{dot_x + 50}" cy="{qy - 3}" r="5" fill="{c}"/>')
                L.append(_text(dot_x + 50, qy, "\u2713" if ch_ok else "\u2717", "white", 7, "700"))

            # Naive
            c = "#94a3b8" if nv_ok else "#ef4444"
            nx = dot_x + (100 if has_chroma else 50)
            L.append(f'  <circle cx="{nx}" cy="{qy - 3}" r="5" fill="{c}"/>')
            L.append(_text(nx, qy, "\u2713" if nv_ok else "\u2717", "white", 7, "700"))

            # Legend labels (first row only)
            if j == 0:
                L.append(_text(dot_x, qy - 14, "TD", "#64748b", 8, "600"))
                if has_chroma:
                    L.append(_text(dot_x + 50, qy - 14, "Vec", "#64748b", 8, "600"))
                L.append(_text(nx, qy - 14, "Nv", "#64748b", 8, "600"))

            qy += 20

    # ── Footer ──
    fy = H - 36
    L.append(_rect(M, fy, W - 2 * M, 26, "#f0fdf4", 6, "#bbf7d0"))
    winner = "TreeDex" if td_recall >= ch_recall and td_recall >= nv_recall else ("ChromaDB" if ch_recall >= nv_recall else "Naive")
    L.append(_text(
        W // 2, fy + 17,
        f"Best page recall: {winner}  |  {n_queries} queries  |  Real benchmark on {doc}",
        "#16a34a", 11, "600",
    ))

    L.append("</svg>")
    return "\n".join(L)


# ---------------------------------------------------------------------------
# Standard benchmark SVG (existing)
# ---------------------------------------------------------------------------

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

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    benchmarks = results.get("benchmarks", [])
    real_bench = None
    for b in benchmarks:
        if b.get("name") == "electromagnetic_waves":
            real_bench = b
            break

    W = 900
    M = 30
    CARD_W = (W - 2 * M - 20) // 2
    CARD_H = 96
    GAP = 16

    tree_h = 200 if real_bench else 0
    H = 56 + 28 + 2 * (CARD_H + GAP) + GAP + tree_h + (GAP if tree_h else 0) + 34 + 8

    L = []
    L.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="system-ui, -apple-system, sans-serif">')

    L.append("  <defs>")
    for gid, c1, c2 in [("hdr", "#1e293b", "#334155"), ("g1", "#22c55e", "#16a34a"), ("g2", "#3b82f6", "#2563eb"), ("g3", "#f59e0b", "#d97706"), ("g4", "#8b5cf6", "#7c3aed")]:
        L.append(f'    <linearGradient id="{gid}" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:{c1}"/><stop offset="100%" style="stop-color:{c2}"/></linearGradient>')
    L.append('    <filter id="sh"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.08"/></filter>')
    L.append("  </defs>")

    L.append(_rect(0, 0, W, H, "#fafafa", 12))
    L.append(_rect(0, 0, W, 56, "url(#hdr)", 12))
    L.append(_rect(0, 20, W, 36, "url(#hdr)", 0))
    L.append(_text(W // 2, 36, "TreeDex Benchmark Results", "white", 20, "700"))

    doc_short = (doc[:55] + "...") if len(doc) > 58 else doc
    L.append(_text(W // 2, 74, f"{doc_short}  |  {ts}", "#64748b", 11))

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

    if real_bench:
        box_y = section_y
        L.append(_rect(M, box_y, W - 2 * M, tree_h, "white", 10, "#e2e8f0", 1, 'filter="url(#sh)"'))
        L.append(_text(W // 2, box_y + 22, "Example: Electromagnetic Waves Index Tree", "#1e293b", 13, "700"))
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
            if depth > 0:
                L.append(_line(indent - 12, ty - 5, indent - 4, ty - 5, "#cbd5e1", 1.5))
                L.append(f'  <circle cx="{indent}" cy="{ty - 5}" r="3" fill="#22c55e"/>')
            else:
                L.append(f'  <circle cx="{indent}" cy="{ty - 5}" r="4" fill="#1e293b"/>')
            L.append(_text(indent + 10, ty - 1, title, "#1e293b", 11, "500", "start"))
            L.append(_text(W - M - 20, ty - 1, pages, "#94a3b8", 10, "400", "end"))
            ty += 16
        section_y = box_y + tree_h + GAP

    fy = H - 38
    L.append(_rect(M, fy, W - 2 * M, 26, "#f0fdf4", 6, "#bbf7d0"))
    L.append(_text(W // 2, fy + 17, f"Avg {avg_chars:,} chars/node  |  {total_nodes} nodes  |  {index_kb:.1f} KB  |  {build_ms:.1f} ms build", "#16a34a", 11, "600"))

    L.append("</svg>")
    return "\n".join(L)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="Results JSON file")
    parser.add_argument("output", help="Output SVG file")
    parser.add_argument("--comparison", action="store_true", help="Generate comparison SVG")
    args = parser.parse_args()

    with open(args.input) as f:
        results = json.load(f)

    if args.comparison:
        svg = generate_comparison_svg(results)
    else:
        svg = generate_svg(results)

    with open(args.output, "w") as f:
        f.write(svg)
    print(f"SVG generated: {args.output}")


if __name__ == "__main__":
    main()
