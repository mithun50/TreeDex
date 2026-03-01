"""Generate benchmark SVG chart from results JSON.

Usage:
    python benchmarks/generate_svg.py benchmark_results.json assets/benchmarks.svg
"""

import json
import sys
from datetime import datetime, timezone


def _escape(text: str) -> str:
    """Escape XML special characters."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _rect(x, y, w, h, fill, rx=4, stroke=None, stroke_w=1, extra=""):
    s = f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"'
    if stroke:
        s += f' stroke="{stroke}" stroke-width="{stroke_w}"'
    if extra:
        s += f" {extra}"
    s += "/>"
    return s


def _text(x, y, text, fill="#1e293b", size=12, weight="400", anchor="middle"):
    return (
        f'  <text x="{x}" y="{y}" text-anchor="{anchor}" '
        f'fill="{fill}" font-size="{size}" font-weight="{weight}">'
        f'{_escape(str(text))}</text>'
    )


def generate_svg(results: dict) -> str:
    """Generate an SVG benchmark chart from results dict."""

    build_time_ms = results["build_time_seconds"] * 1000
    index_kb = results["index_size_kb"]
    total_nodes = results["node_stats"]["total_nodes"]
    total_chars = results["node_stats"]["total_text_chars"]
    avg_chars = results["node_stats"]["avg_chars_per_node"]
    doc = results["document"]

    acc = results.get("retrieval_accuracy", {})
    accuracy_pct = acc.get("overall_accuracy", 0) * 100
    total_queries = acc.get("total_queries", 0)
    details = acc.get("details", [])

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # Layout constants
    W = 900
    MARGIN = 30
    CARD_W = (W - 2 * MARGIN - 20) // 2  # 2 columns with 20px gap
    CARD_H = 100
    CARD_GAP = 20
    ROW_H = 18  # per-query row height

    # Calculate how many query rows to show (max 20)
    n_rows = min(len(details), 20)

    # Calculate dynamic heights
    header_h = 56
    subtitle_h = 30
    cards_h = 2 * CARD_H + CARD_GAP  # 2 rows of cards
    query_title_h = 36
    query_rows_h = n_rows * ROW_H if n_rows > 0 else 30
    query_box_h = query_title_h + query_rows_h + 16  # padding
    footer_h = 32

    H = header_h + subtitle_h + cards_h + CARD_GAP + query_box_h + CARD_GAP + footer_h + 10

    lines = []
    lines.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
        f'font-family="system-ui, -apple-system, sans-serif">'
    )

    # ── Defs ──
    lines.append("  <defs>")
    gradients = [
        ("hdr", "#1e293b", "#334155"),
        ("bar1", "#22c55e", "#16a34a"),
        ("bar2", "#3b82f6", "#2563eb"),
        ("bar3", "#f59e0b", "#d97706"),
        ("bar4", "#8b5cf6", "#7c3aed"),
    ]
    for gid, c1, c2 in gradients:
        lines.append(f'    <linearGradient id="{gid}" x1="0%" y1="0%" x2="100%" y2="0%">')
        lines.append(f'      <stop offset="0%" style="stop-color:{c1}"/>')
        lines.append(f'      <stop offset="100%" style="stop-color:{c2}"/>')
        lines.append("    </linearGradient>")
    lines.append('    <filter id="sh">')
    lines.append('      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.08"/>')
    lines.append("    </filter>")
    lines.append("  </defs>")

    # ── Background ──
    lines.append(_rect(0, 0, W, H, "#fafafa", 12))

    # ── Header ──
    lines.append(_rect(0, 0, W, header_h, "url(#hdr)", 12))
    lines.append(_rect(0, 20, W, header_h - 20, "url(#hdr)", 0))
    lines.append(_text(W // 2, 36, "TreeDex Benchmark Results", "white", 20, "700"))

    # ── Subtitle ──
    sub_y = header_h + 20
    # Truncate doc name if too long
    doc_short = doc if len(doc) <= 60 else doc[:57] + "..."
    lines.append(_text(W // 2, sub_y, f"{doc_short}  |  {timestamp}", "#64748b", 11))

    # ── Metric cards (2x2) ──
    cards_y = sub_y + 16
    cards = [
        ("Build Time", f"{build_time_ms:.1f} ms", "url(#bar1)", "Tree index build time"),
        ("Index Size", f"{index_kb:.1f} KB", "url(#bar2)", "JSON index on disk"),
        ("Structure Validation", f"{accuracy_pct:.0f}%", "url(#bar3)", f"{total_queries} queries matched to nodes"),
        ("Tree Nodes", f"{total_nodes}", "url(#bar4)", f"{total_chars:,} total chars"),
    ]

    for i, (label, value, color, desc) in enumerate(cards):
        col = i % 2
        row = i // 2
        cx = MARGIN + col * (CARD_W + CARD_GAP)
        cy = cards_y + row * (CARD_H + CARD_GAP)

        lines.append(_rect(cx, cy, CARD_W, CARD_H, "white", 10, "#e2e8f0", 1, 'filter="url(#sh)"'))
        lines.append(_rect(cx, cy, 6, CARD_H, color, 3))
        lines.append(_text(cx + 24, cy + 28, label, "#64748b", 12, "600", "start"))
        lines.append(_text(cx + 24, cy + 58, value, "#1e293b", 26, "800", "start"))
        lines.append(_text(cx + 24, cy + 80, desc, "#94a3b8", 11, "400", "start"))

    # ── Per-query bar chart ──
    qbox_y = cards_y + 2 * (CARD_H + CARD_GAP) + 4

    lines.append(_rect(MARGIN, qbox_y, W - 2 * MARGIN, query_box_h, "white", 10, "#e2e8f0", 1, 'filter="url(#sh)"'))
    lines.append(_text(W // 2, qbox_y + 22, "Per-Query Node Matching", "#1e293b", 14, "700"))

    if details:
        bar_top = qbox_y + query_title_h
        label_x = MARGIN + 18
        bar_x = 360
        max_bar_w = W - MARGIN - bar_x - 80  # room for percentage label

        for j in range(n_rows):
            d = details[j]
            ry = bar_top + j * ROW_H
            q_short = d["query"][:42] + ("..." if len(d["query"]) > 42 else "")
            a = d["accuracy"]
            bw = max(int(a * max_bar_w), 3)

            lines.append(_text(label_x, ry + 13, q_short, "#475569", 10, "400", "start"))
            lines.append(_rect(bar_x, ry + 2, bw, ROW_H - 4, "url(#bar3)", 3))
            lines.append(_text(bar_x + bw + 8, ry + 13, f"{a:.0%}", "#d97706", 10, "700", "start"))

        if len(details) > n_rows:
            lines.append(_text(
                W // 2, bar_top + n_rows * ROW_H + 10,
                f"... and {len(details) - n_rows} more queries",
                "#94a3b8", 10, "400",
            ))
    else:
        lines.append(_text(W // 2, qbox_y + query_box_h // 2, "No query data available", "#94a3b8", 12))

    # ── Footer ──
    fy = H - footer_h - 4
    lines.append(_rect(MARGIN, fy, W - 2 * MARGIN, 26, "#f0fdf4", 6, "#bbf7d0"))
    lines.append(_text(
        W // 2, fy + 17,
        f"Avg {avg_chars:,} chars/node  |  {total_nodes} nodes  |  {index_kb:.1f} KB index  |  {build_time_ms:.1f} ms build",
        "#16a34a", 11, "600",
    ))

    lines.append("</svg>")
    return "\n".join(lines)


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
