import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS } from "../constants/colors";
import { useTreeLayout2D, NodeLayout, EdgeLayout } from "../hooks/useTreeLayout2D";

interface AnimatedTreeProps {
  /** 0..1 how much of the tree is revealed (staggered) */
  revealProgress: number;
  /** Node IDs to highlight (glow green) */
  highlightNodes?: string[];
  /** 0..1 progress of pulse traveling from root */
  pulseProgress?: number;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}

export const AnimatedTree: React.FC<AnimatedTreeProps> = ({
  revealProgress,
  highlightNodes = [],
  pulseProgress,
  width = 700,
  height = 500,
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { nodes, edges } = useTreeLayout2D(width, height);

  const totalNodes = nodes.length;
  const highlightSet = new Set(highlightNodes);
  const hasHighlight = highlightNodes.length > 0;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={style}
    >
      {/* SVG Definitions for reusable gradients & filters */}
      <defs>
        {/* Node gradient — cyan core with darker edge */}
        <radialGradient id="nodeGrad" cx="35%" cy="35%">
          <stop offset="0%" stopColor={COLORS.white} stopOpacity={0.9} />
          <stop offset="40%" stopColor={COLORS.primary} stopOpacity={1} />
          <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0.8} />
        </radialGradient>
        {/* Highlighted node gradient — green */}
        <radialGradient id="hlGrad" cx="35%" cy="35%">
          <stop offset="0%" stopColor="#86efac" stopOpacity={0.95} />
          <stop offset="40%" stopColor={COLORS.success} stopOpacity={1} />
          <stop offset="100%" stopColor="#15803d" stopOpacity={0.85} />
        </radialGradient>
        {/* Glow filter for highlighted nodes */}
        <filter id="glowGreen" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.13  0 0 0 0 0.77  0 0 0 0 0.37  0 0 0 0.6 0"
          />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Glow filter for normal nodes */}
        <filter id="glowCyan" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.02  0 0 0 0 0.71  0 0 0 0 0.83  0 0 0 0.35 0"
          />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Pulse glow */}
        <filter id="pulseGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
        </filter>
      </defs>

      {/* Edges — drawn behind nodes */}
      {edges.map((edge) => {
        const fromNode = nodes.find((n) => n.nodeId === edge.from);
        if (!fromNode) return null;

        const edgeThreshold = (fromNode.index + 1) / totalNodes;
        const edgeVisible = revealProgress >= edgeThreshold;
        const edgeProgress = edgeVisible
          ? Math.min((revealProgress - edgeThreshold) / (1 / totalNodes), 1)
          : 0;

        const isHighlightEdge =
          hasHighlight &&
          (highlightSet.has(edge.from) && highlightSet.has(edge.to));
        const edgeOpacity = hasHighlight
          ? isHighlightEdge ? 0.85 : 0.08
          : 0.5;

        return (
          <TreeEdge
            key={`${edge.from}-${edge.to}`}
            edge={edge}
            drawProgress={edgeProgress}
            opacity={edgeOpacity}
            highlighted={isHighlightEdge && hasHighlight}
            frame={frame}
          />
        );
      })}

      {/* Nodes — drawn on top */}
      {nodes.map((node) => {
        const nodeThreshold = node.index / totalNodes;
        const nodeVisible = revealProgress >= nodeThreshold;
        const revealT = nodeVisible
          ? Math.min((revealProgress - nodeThreshold) / (1 / totalNodes), 1)
          : 0;

        const isHighlighted = highlightSet.has(node.nodeId);
        const dimmed = hasHighlight && !isHighlighted;

        return (
          <TreeNodeCircle
            key={node.nodeId}
            node={node}
            revealT={revealT}
            highlighted={isHighlighted}
            dimmed={dimmed}
            frame={frame}
            isRoot={node.depth === 0}
          />
        );
      })}

      {/* Pulse dot traveling along edges */}
      {pulseProgress !== undefined && pulseProgress > 0 && pulseProgress < 1 && (
        <PulseDot
          edges={edges}
          progress={pulseProgress}
          frame={frame}
        />
      )}
    </svg>
  );
};

// ── Bezier Edge ──────────────────────────────────

const TreeEdge: React.FC<{
  edge: EdgeLayout;
  drawProgress: number;
  opacity: number;
  highlighted: boolean;
  frame: number;
}> = ({ edge, drawProgress, opacity, highlighted, frame }) => {
  // Smooth cubic bezier curve
  const midY = edge.y1 + (edge.y2 - edge.y1) * 0.5;
  const d = `M ${edge.x1} ${edge.y1} C ${edge.x1} ${midY}, ${edge.x2} ${midY}, ${edge.x2} ${edge.y2}`;

  const dx = edge.x2 - edge.x1;
  const dy = edge.y2 - edge.y1;
  const pathLen = Math.sqrt(dx * dx + dy * dy) * 1.4;

  const baseColor = highlighted ? COLORS.success : COLORS.primary;
  const glowWidth = highlighted ? 6 : 3;
  const strokeWidth = highlighted ? 2 : 1.2;

  return (
    <g opacity={opacity}>
      {/* Glow layer */}
      <path
        d={d}
        fill="none"
        stroke={baseColor}
        strokeWidth={glowWidth}
        strokeLinecap="round"
        opacity={0.15}
        strokeDasharray={pathLen}
        strokeDashoffset={pathLen * (1 - drawProgress)}
      />
      {/* Main stroke */}
      <path
        d={d}
        fill="none"
        stroke={baseColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={pathLen}
        strokeDashoffset={pathLen * (1 - drawProgress)}
      />
    </g>
  );
};

// ── Node Circle ──────────────────────────────────

const TreeNodeCircle: React.FC<{
  node: NodeLayout;
  revealT: number;
  highlighted: boolean;
  dimmed: boolean;
  frame: number;
  isRoot: boolean;
}> = ({ node, revealT, highlighted, dimmed, frame, isRoot }) => {
  if (revealT <= 0) return null;

  const baseRadius = isRoot ? 10 : highlighted ? 9 : 6;
  const radius = baseRadius * Math.min(revealT * 1.2, 1);
  const opacity = dimmed ? 0.15 : revealT;
  const pulse = highlighted ? 1 + 0.12 * Math.sin(frame * 0.12) : 1;
  const filter = highlighted ? "url(#glowGreen)" : dimmed ? undefined : "url(#glowCyan)";
  const fill = highlighted ? "url(#hlGrad)" : "url(#nodeGrad)";

  return (
    <g opacity={opacity} filter={filter}>
      {/* Outer ring for highlighted */}
      {highlighted && (
        <>
          <circle
            cx={node.x}
            cy={node.y}
            r={radius * 3}
            fill={`${COLORS.success}08`}
          />
          <circle
            cx={node.x}
            cy={node.y}
            r={radius * 2}
            fill="none"
            stroke={COLORS.success}
            strokeWidth={0.5}
            opacity={0.3 + 0.2 * Math.sin(frame * 0.08)}
            strokeDasharray="4 4"
          />
        </>
      )}
      {/* Main node */}
      <circle
        cx={node.x}
        cy={node.y}
        r={radius * pulse}
        fill={fill}
      />
      {/* Bright center dot */}
      <circle
        cx={node.x - radius * 0.2}
        cy={node.y - radius * 0.2}
        r={radius * 0.25}
        fill="white"
        opacity={0.4}
      />

      {/* Label with background for readability */}
      {!dimmed && (
        <>
          <rect
            x={node.x - 50}
            y={node.y + radius + 5}
            width={100}
            height={14}
            rx={3}
            fill={COLORS.bg}
            opacity={0.6}
          />
          <text
            x={node.x}
            y={node.y + radius + 15}
            textAnchor="middle"
            fontSize={isRoot ? 10 : 8}
            fontWeight={isRoot ? 600 : 400}
            fill={highlighted ? COLORS.success : COLORS.white}
            fontFamily="system-ui, -apple-system, sans-serif"
            opacity={0.85}
            letterSpacing="0.01em"
          >
            {node.title.length > 20
              ? node.title.slice(0, 18) + "\u2026"
              : node.title}
          </text>
        </>
      )}

      {/* Node ID badge for highlighted */}
      {highlighted && (
        <>
          <rect
            x={node.x + radius + 4}
            y={node.y - 7}
            width={36}
            height={14}
            rx={3}
            fill={COLORS.success}
            opacity={0.2}
          />
          <text
            x={node.x + radius + 22}
            y={node.y + 3}
            textAnchor="middle"
            fontSize={8}
            fontWeight={600}
            fill={COLORS.success}
            fontFamily="'SF Mono', monospace"
          >
            {node.nodeId}
          </text>
        </>
      )}
    </g>
  );
};

// ── Pulse Dot ────────────────────────────────────

const PulseDot: React.FC<{
  edges: EdgeLayout[];
  progress: number;
  frame: number;
}> = ({ edges, progress, frame }) => {
  if (edges.length === 0) return null;

  const edgeIdx = Math.min(
    Math.floor(progress * edges.length),
    edges.length - 1,
  );
  const edge = edges[edgeIdx];
  const edgeT = (progress * edges.length) % 1;

  // Interpolate along bezier curve (simplified as linear for now)
  const x = edge.x1 + (edge.x2 - edge.x1) * edgeT;
  const midY = edge.y1 + (edge.y2 - edge.y1) * 0.5;
  // Approximate cubic bezier y
  const t = edgeT;
  const y =
    (1 - t) * (1 - t) * (1 - t) * edge.y1 +
    3 * (1 - t) * (1 - t) * t * midY +
    3 * (1 - t) * t * t * midY +
    t * t * t * edge.y2;

  const pulseSize = 4 + 2 * Math.sin(frame * 0.15);

  return (
    <g>
      {/* Trail glow */}
      <circle
        cx={x}
        cy={y}
        r={20}
        fill={COLORS.success}
        opacity={0.08}
        filter="url(#pulseGlow)"
      />
      {/* Outer glow ring */}
      <circle
        cx={x}
        cy={y}
        r={12}
        fill={`${COLORS.success}15`}
      />
      {/* Core dot */}
      <circle
        cx={x}
        cy={y}
        r={pulseSize}
        fill={COLORS.success}
      />
      {/* Bright center */}
      <circle
        cx={x}
        cy={y}
        r={pulseSize * 0.4}
        fill="white"
        opacity={0.8}
      />
    </g>
  );
};
