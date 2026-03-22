import React from "react";
import { useCurrentFrame, interpolate, spring } from "remotion";
import { ACT3, FPS } from "../constants/timing";
import { COLORS } from "../constants/colors";
import { TerminalWindow, TerminalLine } from "../components/TerminalWindow";
import { AnimatedTree } from "../components/AnimatedTree";
import { TextReveal } from "../components/TextReveal";
import { GlowOrb } from "../components/GlowOrb";
import { StepFlow, Step } from "../components/StepFlow";
import { NarratorText } from "../components/FeatureHighlight";
import { IconDocument, IconTree, IconMapPin } from "../components/Icons";
import { useProgress, easeOut } from "../hooks/useProgress";

const TERMINAL_LINES: TerminalLine[] = [
  { text: "$ pip install treedex", type: "command", startFrame: 10, typeDuration: 25 },
  { text: "Collecting treedex", type: "output", startFrame: 40 },
  { text: "Successfully installed treedex-0.1.4", type: "success", startFrame: 55 },
  { text: "", type: "blank", startFrame: 65 },
  { text: "$ python", type: "command", startFrame: 72, typeDuration: 12 },
  { text: "Python 3.11.7 | TreeDex Runtime", type: "output", startFrame: 86 },
  { text: ">>> from treedex import create_index", type: "command", startFrame: 95, typeDuration: 28 },
  { text: "", type: "blank", startFrame: 128 },
  {
    text: '>>> index = create_index("physics_ch8.pdf", provider="openai")',
    type: "command",
    startFrame: 150,
    typeDuration: 45,
  },
  { text: "", type: "blank", startFrame: 200 },
  { text: "Scanning document structure...", type: "output", startFrame: 230 },
  { text: "Found 4 sections, 9 subsections", type: "output", startFrame: 258 },
  { text: "Building tree: 14 nodes across 3 levels", type: "output", startFrame: 290 },
  { text: "Mapping page ranges to leaf nodes...", type: "output", startFrame: 320 },
  { text: "", type: "blank", startFrame: 355 },
  { text: "Index ready. 14 nodes mapped to tree.", type: "success", startFrame: 380 },
];

// How TreeDex works — 3-step pipeline
const HOW_IT_WORKS: Step[] = [
  { number: 1, label: "Parse Structure", icon: <IconDocument size={16} />, color: COLORS.accent },
  { number: 2, label: "Build Tree", icon: <IconTree size={16} />, color: COLORS.primary },
  { number: 3, label: "Map Pages", icon: <IconMapPin size={16} />, color: COLORS.success },
];

export const Act3Solution: React.FC = () => {
  const frame = useCurrentFrame();

  const treeRevealRaw = useProgress(ACT3.treeGrow.start, ACT3.treeGrow.end);
  const treeReveal = easeOut(treeRevealRaw);

  // Active "how it works" step based on terminal progress
  const howStep = frame < 230 ? 1 : frame < 290 ? 2 : 3;

  const labelS = spring({
    frame: Math.max(0, frame - 3),
    fps: FPS,
    config: { damping: 18, mass: 0.7 },
  });
  const treeLabelS = spring({
    frame: Math.max(0, frame - ACT3.treeGrow.start + 10),
    fps: FPS,
    config: { damping: 16, mass: 0.7 },
  });
  const dividerOpacity = interpolate(frame, [20, 50], [0, 0.15], {
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
            radial-gradient(ellipse at 70% 40%, ${COLORS.primary}14, transparent 50%),
            radial-gradient(ellipse at 50% 80%, ${COLORS.success}0a, transparent 45%)
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

      {treeReveal > 0.2 && (
        <GlowOrb x={1500} y={420} size={350 + treeReveal * 100} color={COLORS.primary} opacity={0.05 + treeReveal * 0.08} />
      )}

      {/* Section header */}
      <div style={{ position: "absolute", top: 25, left: 0, right: 0, textAlign: "center" }}>
        <TextReveal
          text="HOW IT WORKS"
          startFrame={3}
          duration={30}
          mode="letterReveal"
          fontSize={13}
          fontWeight={600}
          color={COLORS.primary}
          letterSpacing="0.3em"
        />
        <div style={{ marginTop: 4 }}>
          <TextReveal
            text="Three steps to structure-aware indexing"
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

      {/* How It Works step flow — top center */}
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
          steps={HOW_IT_WORKS}
          startFrame={15}
          stagger={25}
          activeStep={howStep}
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
            color: COLORS.primary,
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontWeight: 600,
            opacity: labelS,
            transform: `translateX(${(1 - labelS) * -20}px)`,
          }}
        >
          TreeDex Pipeline
        </div>
        <TerminalWindow
          lines={TERMINAL_LINES}
          title="treedex \u2014 python3"
          width={940}
          entranceFrame={0}
        />
      </div>

      {/* Right: Animated Tree */}
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
            color: COLORS.muted,
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontWeight: 500,
            opacity: treeLabelS,
          }}
        >
          Document Tree
        </div>

        <AnimatedTree revealProgress={treeReveal} width={780} height={480} />

        {/* Stats row */}
        {treeReveal > 0.8 && (
          <div style={{ display: "flex", gap: 16, opacity: (treeReveal - 0.8) * 5 }}>
            <StatBadge label="Nodes" value="14" color={COLORS.primary} />
            <StatBadge label="Levels" value="3" color={COLORS.accent} />
            <StatBadge label="Sections" value="4" color={COLORS.success} />
          </div>
        )}
      </div>

      {/* Narrator text — how it works explanation for TTS */}
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
          text="TreeDex takes a different approach. Install with one command. It scans the table of contents, builds a hierarchical tree, and maps each node to its source pages. No embeddings. No vector database. The structure is preserved."
          startFrame={15}
          endFrame={460}
        />
      </div>

      {/* Bottom: "Structure Preserved." */}
      <div style={{ position: "absolute", bottom: 45, left: 0, right: 0, textAlign: "center" }}>
        <TextReveal
          text="Structure Preserved."
          startFrame={ACT3.indexReady.start}
          duration={50}
          mode="glowFade"
          fontSize={48}
          fontWeight={600}
          color={COLORS.success}
          style={{ textShadow: `0 0 40px ${COLORS.success}40, 0 0 80px ${COLORS.success}15` }}
        />
      </div>
    </div>
  );
};

const StatBadge: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      padding: "6px 14px",
      background: `${color}08`,
      border: `1px solid ${color}20`,
      borderRadius: 6,
    }}
  >
    <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'SF Mono', monospace" }}>{value}</div>
    <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
  </div>
);
