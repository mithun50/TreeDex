import React from "react";
import { useCurrentFrame, spring } from "remotion";
import { ACT1, FPS } from "../constants/timing";
import { COLORS } from "../constants/colors";
import { ParticleBackground } from "../components/ParticleBackground";
import { TextReveal } from "../components/TextReveal";
import { GlowOrb } from "../components/GlowOrb";
import { NarratorText } from "../components/FeatureHighlight";
import { useProgress, easeOut } from "../hooks/useProgress";

export const Act1Hero: React.FC = () => {
  const frame = useCurrentFrame();

  const coalesceRaw = useProgress(ACT1.particleCoalesce.start, ACT1.particleCoalesce.end);
  const coalescence = easeOut(coalesceRaw);

  const bgScale = 1 + frame * 0.0001;

  const titleS = spring({
    frame: Math.max(0, frame - ACT1.titleReveal.start),
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
      {/* Multi-layer background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${bgScale})`,
          background: `
            radial-gradient(ellipse at 50% 40%, ${COLORS.primary}18 0%, transparent 55%),
            radial-gradient(ellipse at 30% 70%, ${COLORS.accent}10 0%, transparent 45%),
            radial-gradient(ellipse at 70% 30%, ${COLORS.primary}0c 0%, transparent 50%)
          `,
        }}
      />

      {/* Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.025,
          backgroundImage: `
            linear-gradient(${COLORS.primary}40 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.primary}40 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      <ParticleBackground coalescence={coalescence} />

      <GlowOrb x={960} y={480} size={200 + coalescence * 300} color={COLORS.accent} opacity={0.06 + coalescence * 0.08} />
      <GlowOrb x={960} y={520} size={300 + coalescence * 200} color={COLORS.primary} opacity={0.08 + coalescence * 0.2} />

      {/* Center content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
        }}
      >
        <TextReveal
          text="INTRODUCING"
          startFrame={ACT1.titleReveal.start - 15}
          duration={40}
          mode="fade"
          fontSize={14}
          fontWeight={500}
          color={COLORS.primary}
          letterSpacing="0.35em"
        />

        <div style={{ height: 20 }} />

        <TextReveal
          text="TREEDEX"
          startFrame={ACT1.titleReveal.start}
          duration={ACT1.titleReveal.end - ACT1.titleReveal.start}
          mode="letterReveal"
          fontSize={140}
          fontWeight={800}
          letterSpacing="0.14em"
          color={COLORS.white}
          style={{
            textShadow: `
              0 0 80px ${COLORS.primary}40,
              0 0 160px ${COLORS.primary}15,
              0 4px 30px rgba(0,0,0,0.5)
            `,
          }}
        />

        {/* Animated HR — wider, gradient both sides */}
        <div
          style={{
            width: titleS * 280,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${COLORS.primary}50, ${COLORS.accent}40, ${COLORS.primary}50, transparent)`,
            marginTop: 22,
            marginBottom: 16,
            borderRadius: 1,
          }}
        />

        {/* Version badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: titleS * 0.6,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              padding: "3px 10px",
              borderRadius: 4,
              background: `${COLORS.primary}15`,
              border: `1px solid ${COLORS.primary}30`,
              fontSize: 11,
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              color: COLORS.primary,
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}
          >
            v0.1.4
          </div>
          <div
            style={{
              fontSize: 11,
              color: COLORS.dim,
              fontFamily: "system-ui, sans-serif",
              letterSpacing: "0.02em",
            }}
          >
            Open Source
          </div>
        </div>

        <TextReveal
          text="Structure-Aware Document Intelligence"
          startFrame={ACT1.tagline.start}
          duration={ACT1.tagline.end - ACT1.tagline.start}
          mode="wordByWord"
          fontSize={28}
          fontWeight={400}
          color={COLORS.muted}
          letterSpacing="0.05em"
        />

        {/* Subtext — expanded explanation */}
        <div style={{ height: 14 }} />
        <TextReveal
          text="No vectors. No embeddings. Just structure."
          startFrame={ACT1.tagline.start + 30}
          duration={50}
          mode="fade"
          fontSize={18}
          fontWeight={400}
          color={COLORS.dim}
          letterSpacing="0.03em"
          fontFamily="'SF Mono', 'Fira Code', monospace"
        />
      </div>

      {/* Narrator subtitle — hook question for TTS */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <NarratorText
          text="What if RAG understood your document's structure? Introducing TreeDex. Structure-aware document intelligence."
          startFrame={30}
          endFrame={230}
        />
      </div>

      {/* Bottom vignette */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 200,
          background: `linear-gradient(transparent, ${COLORS.bg}80)`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
