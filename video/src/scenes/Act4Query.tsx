import React from "react";
import { useCurrentFrame, interpolate, spring } from "remotion";
import { ACT4, FPS } from "../constants/timing";
import { COLORS } from "../constants/colors";
import { TerminalWindow, TerminalLine } from "../components/TerminalWindow";
import { AnimatedTree } from "../components/AnimatedTree";
import { TextReveal } from "../components/TextReveal";
import { GlowOrb } from "../components/GlowOrb";
import { StepFlow, Step } from "../components/StepFlow";
import { NarratorText } from "../components/FeatureHighlight";
import { IconQuestion, IconTree, IconCheckCircle, IconSparkles } from "../components/Icons";
import { useProgress, easeInOut } from "../hooks/useProgress";

const TERMINAL_LINES: TerminalLine[] = [
  {
    text: '>>> result = index.query("What are displacement current sources?")',
    type: "command",
    startFrame: 10,
    typeDuration: 50,
  },
  { text: "", type: "blank", startFrame: 65 },
  { text: "Traversing tree...", type: "output", startFrame: 100 },
  { text: "  \u2192 Node 0001: Chapter Eight EM WAVES", type: "output", startFrame: 120 },
  { text: "  \u2192 Node 0003: DISPLACEMENT CURRENT \u2713", type: "success", startFrame: 148 },
  { text: "  \u2192 Node 0004: ELECTROMAGNETIC WAVES \u2713", type: "success", startFrame: 168 },
  { text: "", type: "blank", startFrame: 190 },
  { text: "Selected 2 nodes (pages 1\u20136)", type: "output", startFrame: 200 },
  { text: "Generating response from selected context...", type: "output", startFrame: 240 },
  { text: "", type: "blank", startFrame: 260 },
  {
    text: '"Displacement current arises from time-varying electric fields',
    type: "success",
    startFrame: 272,
  },
  {
    text: ' between capacitor plates, as described by Maxwell..."',
    type: "success",
    startFrame: 285,
  },
];

// Query pipeline steps
const QUERY_STEPS: Step[] = [
  { number: 1, label: "Receive Query", icon: <IconQuestion size={16} />, color: COLORS.accent },
  { number: 2, label: "Traverse Tree", icon: <IconTree size={16} />, color: COLORS.primary },
  { number: 3, label: "Select Nodes", icon: <IconCheckCircle size={16} />, color: COLORS.success },
  { number: 4, label: "Generate", icon: <IconSparkles size={16} />, color: COLORS.success },
];

export const Act4Query: React.FC = () => {
  const frame = useCurrentFrame();

  const pulseRaw = useProgress(ACT4.traversal.start, ACT4.traversal.end);
  const pulseProgress = easeInOut(pulseRaw);

  const highlightRaw = useProgress(ACT4.highlight.start, ACT4.highlight.end);
  const highlightNodes = highlightRaw > 0 ? ["0001", "0003", "0004"] : [];

  const greenGlow = highlightRaw * 0.1;

  // Active query step
  const queryStep =
    frame < 100 ? 1 : frame < 190 ? 2 : frame < 260 ? 3 : 4;

  const labelS = spring({
    frame: Math.max(0, frame - 3),
    fps: FPS,
    config: { damping: 18, mass: 0.7 },
  });
  const dividerOpacity = interpolate(frame, [10, 40], [0, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        background: COLORS.bg,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 30% 50%, ${COLORS.accent}10, transparent 55%),
            radial-gradient(ellipse at 70% 40%, ${COLORS.success}${Math.round(greenGlow * 255).toString(16).padStart(2, "0")}, transparent 45%)
          `,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.022,
          backgroundImage: `
            linear-gradient(${COLORS.primary}30 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.primary}30 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {highlightRaw > 0 && (
        <GlowOrb x={1480} y={350} size={300} color={COLORS.success} opacity={greenGlow} />
      )}

      {/* Section header */}
      <div style={{ position: "absolute", top: 25, left: 0, right: 0, textAlign: "center" }}>
        <TextReveal
          text="QUERYING"
          startFrame={3}
          duration={30}
          mode="letterReveal"
          fontSize={13}
          fontWeight={600}
          color={COLORS.success}
          letterSpacing="0.3em"
        />
        <div style={{ marginTop: 4 }}>
          <TextReveal
            text="Tree-guided retrieval, not brute-force search"
            startFrame={12}
            duration={40}
            mode="fade"
            fontSize={11}
            fontWeight={400}
            color={COLORS.dim}
            letterSpacing="0.05em"
          />
        </div>
      </div>

      {/* Query step flow — top */}
      <div
        style={{
          position: "absolute",
          top: 50,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <StepFlow
          steps={QUERY_STEPS}
          startFrame={5}
          stagger={20}
          activeStep={queryStep}
          direction="horizontal"
        />
      </div>

      {/* Vertical divider */}
      <div
        style={{
          position: "absolute",
          left: 1030,
          top: 120,
          bottom: 100,
          width: 1,
          background: `linear-gradient(transparent, ${COLORS.primary}${Math.round(dividerOpacity * 255).toString(16).padStart(2, "0")}, transparent)`,
        }}
      />

      {/* Left: Terminal */}
      <div
        style={{
          position: "absolute",
          left: 55,
          top: 130,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: COLORS.success,
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontWeight: 600,
            opacity: labelS,
            transform: `translateX(${(1 - labelS) * -20}px)`,
          }}
        >
          Tree-Guided Query
        </div>
        <TerminalWindow
          lines={TERMINAL_LINES}
          title="treedex \u2014 python3"
          width={940}
          entranceFrame={0}
        />
      </div>

      {/* Right: Tree with highlights & pulse */}
      <div
        style={{
          position: "absolute",
          right: 20,
          top: 130,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: highlightRaw > 0 ? COLORS.success : COLORS.muted,
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontWeight: 500,
            opacity: labelS,
          }}
        >
          {highlightRaw > 0 ? "Nodes Selected" : "Tree Traversal"}
        </div>
        <AnimatedTree
          revealProgress={1}
          highlightNodes={highlightNodes}
          pulseProgress={pulseProgress}
          width={780}
          height={480}
        />

        {/* Result badges */}
        {highlightRaw > 0.5 && (
          <div style={{ display: "flex", gap: 12, opacity: Math.min((highlightRaw - 0.5) * 4, 1) }}>
            <ResultBadge nodeId="0003" label="DISPLACEMENT CURRENT" pages="pp. 1\u20133" />
            <ResultBadge nodeId="0004" label="ELECTROMAGNETIC WAVES" pages="pp. 4\u20136" />
          </div>
        )}
      </div>

      {/* Narrator text */}
      <div
        style={{
          position: "absolute",
          bottom: 115,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <NarratorText
          text="When you query, TreeDex traverses the document tree to find the most relevant sections. Only selected pages are sent to the LLM. Precise context, no noise."
          startFrame={15}
          endFrame={340}
        />
      </div>
    </div>
  );
};

const ResultBadge: React.FC<{ nodeId: string; label: string; pages: string }> = ({ nodeId, label, pages }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "5px 12px",
      background: `${COLORS.success}0a`,
      border: `1px solid ${COLORS.success}25`,
      borderRadius: 6,
    }}
  >
    <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.success, fontFamily: "'SF Mono', monospace" }}>
      {nodeId}
    </div>
    <div style={{ width: 1, height: 12, background: `${COLORS.success}30` }} />
    <div style={{ fontSize: 9, color: COLORS.white, fontFamily: "system-ui, sans-serif", fontWeight: 500 }}>
      {label}
    </div>
    <div style={{ width: 1, height: 12, background: `${COLORS.success}20` }} />
    <div style={{ fontSize: 9, color: COLORS.muted, fontFamily: "'SF Mono', monospace" }}>
      {pages}
    </div>
  </div>
);
