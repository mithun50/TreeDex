"""Generate benchmark SVG chart from results JSON.

Usage:
    python benchmarks/generate_svg.py benchmark_results.json assets/benchmarks.svg
"""

import json
import sys
from datetime import datetime, timezone


def bar_rect(x, y, w, h, fill, rx=4):
    return f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"/>'


def text_el(x, y, text, fill="#1e293b", size=12, weight="400", anchor="middle"):
    return (
        f'  <text x="{x}" y="{y}" text-anchor="{anchor}" '
        f'fill="{fill}" font-size="{size}" font-weight="{weight}">{text}</text>'
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

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # Chart dimensions
    W, H = 900, 580
    chart_left = 60
    chart_right = W - 40
    chart_w = chart_right - chart_left

    lines = []
    lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
                 f'font-family="system-ui, -apple-system, sans-serif">')

    # Defs
    lines.append('  <defs>')
    lines.append('    <linearGradient id="hdr" x1="0%" y1="0%" x2="100%" y2="0%">')
    lines.append('      <stop offset="0%" style="stop-color:#1e293b"/>')
    lines.append('      <stop offset="100%" style="stop-color:#334155"/>')
    lines.append('    </linearGradient>')
    lines.append('    <linearGradient id="bar1" x1="0%" y1="0%" x2="100%" y2="0%">')
    lines.append('      <stop offset="0%" style="stop-color:#22c55e"/>')
    lines.append('      <stop offset="100%" style="stop-color:#16a34a"/>')
    lines.append('    </linearGradient>')
    lines.append('    <linearGradient id="bar2" x1="0%" y1="0%" x2="100%" y2="0%">')
    lines.append('      <stop offset="0%" style="stop-color:#3b82f6"/>')
    lines.append('      <stop offset="100%" style="stop-color:#2563eb"/>')
    lines.append('    </linearGradient>')
    lines.append('    <linearGradient id="bar3" x1="0%" y1="0%" x2="100%" y2="0%">')
    lines.append('      <stop offset="0%" style="stop-color:#f59e0b"/>')
    lines.append('      <stop offset="100%" style="stop-color:#d97706"/>')
    lines.append('    </linearGradient>')
    lines.append('    <linearGradient id="bar4" x1="0%" y1="0%" x2="100%" y2="0%">')
    lines.append('      <stop offset="0%" style="stop-color:#8b5cf6"/>')
    lines.append('      <stop offset="100%" style="stop-color:#7c3aed"/>')
    lines.append('    </linearGradient>')
    lines.append('    <filter id="sh">')
    lines.append('      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.08"/>')
    lines.append('    </filter>')
    lines.append('  </defs>')

    # Background
    lines.append(f'  <rect width="{W}" height="{H}" rx="12" fill="#fafafa"/>')

    # Header
    lines.append(f'  <rect x="0" y="0" width="{W}" height="56" rx="12" fill="url(#hdr)"/>')
    lines.append(f'  <rect x="0" y="20" width="{W}" height="36" fill="url(#hdr)"/>')
    lines.append(text_el(W // 2, 36, "TreeDex Benchmark Results", "white", 20, "700"))

    # Subtitle
    lines.append(text_el(W // 2, 78, f"Document: {doc}  |  Generated: {timestamp}", "#64748b", 11))

    # ── Metric cards (2x2 grid) ──────────────────────────────────────────
    cards = [
        ("Build Time", f"{build_time_ms:.1f} ms", "url(#bar1)", "Time to build tree index from pages"),
        ("Index Size", f"{index_kb:.1f} KB", "url(#bar2)", "JSON index size on disk"),
        ("Retrieval Accuracy", f"{accuracy_pct:.0f}%", "url(#bar3)", f"{total_queries} synthetic queries evaluated"),
        ("Tree Nodes", f"{total_nodes}", "url(#bar4)", f"{total_chars:,} chars across all nodes"),
    ]

    card_w = 395
    card_h = 100
    gap = 20
    start_y = 98

    for i, (label, value, color, desc) in enumerate(cards):
        col = i % 2
        row = i // 2
        cx = 30 + col * (card_w + gap)
        cy = start_y + row * (card_h + gap)

        # Card background
        lines.append(f'  <rect x="{cx}" y="{cy}" width="{card_w}" height="{card_h}" '
                     f'rx="10" fill="white" stroke="#e2e8f0" stroke-width="1" filter="url(#sh)"/>')

        # Color accent bar
        lines.append(f'  <rect x="{cx}" y="{cy}" width="6" height="{card_h}" '
                     f'rx="3" fill="{color}"/>')

        # Label
        lines.append(text_el(cx + 24, cy + 28, label, "#64748b", 12, "600", "start"))

        # Value
        lines.append(text_el(cx + 24, cy + 60, value, "#1e293b", 28, "800", "start"))

        # Description
        lines.append(text_el(cx + 24, cy + 82, desc, "#94a3b8", 11, "400", "start"))

    # ── Horizontal bar chart: per-query accuracy ─────────────────────────
    bar_y_start = start_y + 2 * (card_h + gap) + 20

    lines.append(f'  <rect x="30" y="{bar_y_start}" width="{W - 60}" height="220" '
                 f'rx="10" fill="white" stroke="#e2e8f0" stroke-width="1" filter="url(#sh)"/>')

    lines.append(text_el(W // 2, bar_y_start + 24, "Per-Query Retrieval Accuracy", "#1e293b", 14, "700"))

    details = acc.get("details", [])
    if details:
        bar_area_top = bar_y_start + 40
        bar_h = 16
        bar_gap = 3
        max_bar_w = 380
        label_x = 48
        bar_x = 350

        for j, d in enumerate(details[:10]):
            by = bar_area_top + j * (bar_h + bar_gap)
            q_short = d["query"][:40] + ("..." if len(d["query"]) > 40 else "")
            a = d["accuracy"]
            bw = max(int(a * max_bar_w), 2)

            # Query label
            lines.append(text_el(label_x, by + 12, q_short, "#475569", 10, "400", "start"))

            # Bar
            lines.append(bar_rect(bar_x, by, bw, bar_h, "url(#bar3)", 3))

            # Percentage
            lines.append(text_el(bar_x + bw + 8, by + 12, f"{a:.0%}", "#d97706", 10, "700", "start"))
    else:
        lines.append(text_el(W // 2, bar_y_start + 110, "No per-query data available", "#94a3b8", 12))

    # ── Footer ───────────────────────────────────────────────────────────
    fy = H - 36
    lines.append(f'  <rect x="30" y="{fy}" width="{W - 60}" height="26" rx="6" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="1"/>')
    lines.append(text_el(W // 2, fy + 17,
                         f"Avg {avg_chars:,} chars/node  |  {total_nodes} nodes  |  {index_kb:.1f} KB index  |  {build_time_ms:.1f} ms build",
                         "#16a34a", 11, "600"))

    lines.append('</svg>')
    return '\n'.join(lines)


def main():
    if len(sys.argv) < 3:
        print("Usage: python generate_svg.py <results.json> <output.svg>")
        sys.exit(1)

    results_path = sys.argv[1]
    svg_path = sys.argv[2]

    with open(results_path) as f:
        results = json.load(f)

    svg = generate_svg(results)

    with open(svg_path, "w") as f:
        f.write(svg)

    print(f"SVG generated: {svg_path}")


if __name__ == "__main__":
    main()
