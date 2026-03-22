import React from "react";
import { useCurrentFrame, spring } from "remotion";
import { ACT2, FPS } from "../constants/timing";
import { COLORS } from "../constants/colors";
import { TerminalWindow, TerminalLine } from "../components/TerminalWindow";
import { FloatingCards } from "../components/FloatingCards";
import { TextReveal } from "../components/TextReveal";
import { GlowOrb } from "../components/GlowOrb";
import { StepFlow, Step } from "../components/StepFlow";
import { NarratorText } from "../components/FeatureHighlight";
import { IconScissors, IconArrowRight, IconDatabase, IconSearch } from "../components/Icons";
import { GlitchEffect } from "../components/GlitchEffect";
import { useProgress, easeIn } from "../hooks/useProgress";

const TERMINAL_LINES: TerminalLine[] = [
  { text: "$ python traditional_rag.py", type: "command", startFrame: 20, typeDuration: 30 },
  { text: "Loading document: physics_ch8.pdf", type: "output", startFrame: 55 },
  { text: "Splitting into 256-token chunks...", type: "output", startFrame: 70 },
  { text: "Created 47 chunks", type: "output", startFrame: 85 },
  { text: "Embedding chunks into vector store...", type: "output", startFrame: 95 },
  { text: "", type: "blank", startFrame: 108 },
  { text: '$ python query.py "displacement current sources"', type: "command", startFrame: 112, typeDuration: 38 },
  { text: "Searching 47 chunks by cosine similarity...", type: "output", startFrame: 155 },
  { text: "", type: "blank", startFrame: 165 },
  { text: "Top 3 results:", type: "output", startFrame: 168 },
  { text: "  [0.72] chunk_23: ...the magnetic field is not...", type: "output", startFrame: 178 },
  { text: "  [0.69] chunk_07: ...Maxwell noticed an incons...", type: "output", startFrame: 188 },
  { text: "  [0.65] chunk_41: ...radio waves are produced...", type: "output", startFrame: 198 },
  { text: "", type: "blank", startFrame: 210 },
  { text: "WARNING: Retrieved chunks lack structural context", type: "error", startFrame: 218 },
  { text: "Sections split across chunk boundaries", type: "error", startFrame: 228 },
];

// Traditional RAG pipeline steps
const RAG_STEPS: Step[] = [
  { number: 1, label: "Split Text", icon: <IconScissors size={16} /> },
  { number: 2, label: "Embed", icon: <IconArrowRight size={16} /> },
  { number: 3, label: "Vector DB", icon: <IconDatabase size={16} /> },
  { number: 4, label: "Search", icon: <IconSearch size={16} /> },
];

export const Act2Problem: React.FC = () => {
  const frame = useCurrentFrame();

  const floatProgress = useProgress(ACT2.cardsFloat.start, ACT2.cardsFloat.end);
  const shatterRaw = useProgress(ACT2.cardsShatter.start, ACT2.cardsShatter.end);
  const shatterProgress = easeIn(shatterRaw);
  const dangerGlow = shatterProgress * 0.12;

  // Which RAG step is active based on terminal progress
  const ragStep =
    frame < 70 ? 1 : frame < 95 ? 2 : frame < 155 ? 3 : 4;

  const labelS = spring({
    frame: Math.max(0, frame - 5),
    fps: FPS,
    config: { damping: 18, mass: 0.7 },
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
            radial-gradient(ellipse at 25% 50%, ${COLORS.chaos}14, transparent 55%),
            radial-gradient(ellipse at 75% 40%, ${COLORS.chaosRed}${Math.round(dangerGlow * 255).toString(16).padStart(2, "0")}, transparent 50%)
          `,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.02,
          backgroundImage: `
            linear-gradient(${COLORS.chaos}30 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.chaos}30 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
        }}
      />

      <GlowOrb x={1400} y={400} size={300} color={COLORS.chaosRed} opacity={dangerGlow} />

      {/* Top: "THE PROBLEM" section header */}
      <div
        style={{
          position: "absolute",
          top: 30,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <TextReveal
          text="THE PROBLEM"
          startFrame={3}
          duration={30}
          mode="letterReveal"
          fontSize={13}
          fontWeight={600}
          color={COLORS.chaos}
          letterSpacing="0.3em"
        />
        <div style={{ marginTop: 4 }}>
          <TextReveal
            text="Traditional RAG destroys document structure"
            startFrame={15}
            duration={40}
            mode="fade"
            fontSize={11}
            fontWeight={400}
            color={COLORS.dim}
            letterSpacing="0.05em"
          />
        </div>
      </div>

      {/* RAG Pipeline Step Flow — above terminal */}
      <div
        style={{
          position: "absolute",
          left: 70,
          top: 60,
        }}
      >
        <StepFlow
          steps={RAG_STEPS}
          startFrame={10}
          stagger={15}
          activeStep={ragStep}
          direction="horizontal"
        />
      </div>

      {/* Left: Terminal */}
      <div
        style={{
          position: "absolute",
          left: 70,
          top: 145,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: COLORS.chaos,
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontWeight: 600,
            opacity: labelS,
            transform: `translateX(${(1 - labelS) * -20}px)`,
          }}
        >
          Traditional RAG Pipeline
        </div>
        <TerminalWindow
          lines={TERMINAL_LINES}
          title="traditional_rag.py \u2014 bash"
          width={920}
          entranceFrame={8}
        />
      </div>

      {/* Right: Floating chunk cards */}
      <div style={{ position: "absolute", right: 10, top: 100 }}>
        <FloatingCards
          floatProgress={floatProgress}
          shatterProgress={shatterProgress}
          width={700}
          height={600}
        />
      </div>

      {/* Narrator text: explains the problem for TTS */}
      <div
        style={{
          position: "absolute",
          bottom: 130,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <NarratorText
          text="Traditional RAG splits documents into flat chunks, destroying sections and hierarchy. Queries return random fragments with no context. The structure is lost."
          startFrame={25}
          endFrame={ACT2.duration - 30}
        />
      </div>

      {/* Glitch interference during failure */}
      <GlitchEffect
        startFrame={ACT2.failText.start - 10}
        endFrame={ACT2.failText.start + 40}
        intensity={0.6}
        color={COLORS.chaosRed}
      />

      {/* Bottom: "Structure Lost." */}
      <div
        style={{
          position: "absolute",
          bottom: 55,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <TextReveal
          text="Structure Lost."
          startFrame={ACT2.failText.start}
          duration={50}
          mode="glowFade"
          fontSize={56}
          fontWeight={700}
          color={COLORS.chaosRed}
          letterSpacing="0.06em"
          style={{
            textShadow: `0 0 60px ${COLORS.chaosRed}50, 0 0 120px ${COLORS.chaosRed}20`,
          }}
        />
      </div>
    </div>
  );
};
