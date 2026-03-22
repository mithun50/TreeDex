import React from "react";
import { useCurrentFrame, spring } from "remotion";
import { ACT5, FPS } from "../constants/timing";
import { COLORS } from "../constants/colors";
import { AnimatedTree } from "../components/AnimatedTree";
import { TextReveal } from "../components/TextReveal";
import { GlowOrb } from "../components/GlowOrb";
import { ParticleBackground } from "../components/ParticleBackground";
import { FeatureHighlight, Feature, NarratorText } from "../components/FeatureHighlight";
import { IconGitBranch, IconCpu, IconBolt, IconPackage } from "../components/Icons";
import { PROVIDERS } from "../constants/tree-data";

const FEATURES: Feature[] = [
  { icon: <IconGitBranch size={24} />, title: "Tree-Based", subtitle: "Structure-Aware RAG", color: COLORS.primary },
  { icon: <IconCpu size={24} />, title: "14+ LLMs", subtitle: "Provider Support", color: COLORS.accent },
  { icon: <IconBolt size={24} />, title: "Zero Vector DB", subtitle: "No Embeddings Needed", color: COLORS.success },
  { icon: <IconPackage size={24} />, title: "pip install", subtitle: "One-Line Setup", color: COLORS.primary },
];

export const Act5Closing: React.FC = () => {
  const frame = useCurrentFrame();

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
          background: `
            radial-gradient(ellipse at 50% 30%, ${COLORS.primary}1a 0%, transparent 55%),
            radial-gradient(ellipse at 30% 60%, ${COLORS.accent}10 0%, transparent 45%),
            radial-gradient(ellipse at 70% 70%, ${COLORS.success}0a 0%, transparent 50%)
          `,
        }}
      />

      <ParticleBackground count={60} coalescence={0.3} color={COLORS.accent} />

      <GlowOrb x={960} y={280} size={600} color={COLORS.primary} opacity={0.06} />
      <GlowOrb x={960} y={300} size={400} color={COLORS.accent} opacity={0.08} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.02,
          backgroundImage: `
            linear-gradient(${COLORS.primary}30 1px, transparent 1px),
            linear-gradient(90deg, ${COLORS.primary}30 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Centered tree */}
      <div style={{ position: "absolute", left: 960 - 380, top: 60 }}>
        <AnimatedTree revealProgress={1} width={760} height={340} />
      </div>

      {/* Provider orbit ring */}
      <ProviderOrbit frame={frame} />

      {/* Content stack */}
      <div
        style={{
          position: "absolute",
          top: 440,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
        }}
      >
        {/* Title */}
        <TextReveal
          text="TREEDEX"
          startFrame={ACT5.title.start}
          duration={50}
          mode="letterReveal"
          fontSize={80}
          fontWeight={800}
          letterSpacing="0.12em"
          color={COLORS.white}
          style={{
            textShadow: `
              0 0 60px ${COLORS.primary}40,
              0 0 120px ${COLORS.primary}15,
              0 4px 20px rgba(0,0,0,0.5)
            `,
          }}
        />

        {/* HR */}
        <HorizontalRule frame={frame} startFrame={ACT5.title.start + 20} />

        {/* Subtitle */}
        <div style={{ marginTop: 10 }}>
          <TextReveal
            text="Structure-Aware RAG for Any Document"
            startFrame={ACT5.tagline.start}
            duration={50}
            mode="wordByWord"
            fontSize={22}
            fontWeight={400}
            color={COLORS.muted}
            letterSpacing="0.04em"
          />
        </div>

        {/* Explainer line */}
        <div style={{ marginTop: 6 }}>
          <TextReveal
            text="PDFs, textbooks, reports — indexed in seconds, queried with precision"
            startFrame={ACT5.tagline.start + 20}
            duration={40}
            mode="fade"
            fontSize={14}
            fontWeight={400}
            color={COLORS.dim}
            letterSpacing="0.02em"
            fontFamily="'SF Mono', 'Fira Code', monospace"
          />
        </div>

        {/* Feature highlights row */}
        <div style={{ marginTop: 28 }}>
          <FeatureHighlight
            features={FEATURES}
            startFrame={ACT5.installBadge.start - 20}
            stagger={10}
          />
        </div>

        {/* Install badges */}
        <div style={{ display: "flex", gap: 20, marginTop: 24 }}>
          <InstallBadge
            text="pip install treedex"
            startFrame={ACT5.installBadge.start}
            frame={frame}
            color={COLORS.primary}
            icon="$"
          />
          <InstallBadge
            text="npm i treedex"
            startFrame={ACT5.installBadge.start + 12}
            frame={frame}
            color={COLORS.accent}
            icon=">"
          />
        </div>

        {/* GitHub URL */}
        <div style={{ marginTop: 22 }}>
          <TextReveal
            text="github.com/mithun50/TreeDex"
            startFrame={ACT5.github.start}
            duration={40}
            mode="fade"
            fontSize={18}
            fontWeight={400}
            color={COLORS.dim}
            fontFamily="'SF Mono', 'Fira Code', monospace"
            letterSpacing="0.02em"
          />
        </div>
      </div>

      {/* Narrator — closing CTA for TTS */}
      <div
        style={{
          position: "absolute",
          bottom: 30,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <NarratorText
          text="TreeDex supports fourteen LLM providers. Works with PDFs, textbooks, and reports. One line to install, one line to index, one line to query. Try TreeDex today."
          startFrame={20}
          endFrame={320}
        />
      </div>

      {/* Vignettes */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 80,
          background: `linear-gradient(${COLORS.bg}, transparent)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 120,
          background: `linear-gradient(transparent, ${COLORS.bg})`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

// ── Sub-components ───────────────────────────────

const HorizontalRule: React.FC<{ frame: number; startFrame: number }> = ({ frame, startFrame }) => {
  const s = spring({
    frame: Math.max(0, frame - startFrame),
    fps: FPS,
    config: { damping: 20, mass: 0.6 },
  });
  return (
    <div
      style={{
        width: s * 180,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${COLORS.primary}50, transparent)`,
        marginTop: 12,
      }}
    />
  );
};

const ProviderOrbit: React.FC<{ frame: number }> = ({ frame }) => {
  const centerX = 960;
  const centerY = 260;
  const radiusX = 520;
  const radiusY = 60;
  const rotationSpeed = 0.007;

  return (
    <>
      <svg
        style={{
          position: "absolute",
          left: centerX - radiusX - 20,
          top: centerY - radiusY - 20,
          width: radiusX * 2 + 40,
          height: radiusY * 2 + 40,
          pointerEvents: "none",
        }}
      >
        <ellipse
          cx={radiusX + 20}
          cy={radiusY + 20}
          rx={radiusX}
          ry={radiusY}
          fill="none"
          stroke={COLORS.primary}
          strokeWidth={0.5}
          opacity={0.06}
          strokeDasharray="4 8"
        />
      </svg>

      {PROVIDERS.map((name, i) => {
        const angle = (i / PROVIDERS.length) * Math.PI * 2 + frame * rotationSpeed;
        const x = centerX + Math.cos(angle) * radiusX;
        const y = centerY + Math.sin(angle) * radiusY;
        const depth = (Math.sin(angle) + 1) / 2;
        const opacity = 0.15 + depth * 0.65;
        const scale = 0.65 + depth * 0.35;

        const entrance = spring({
          frame: Math.max(0, frame - 30 - i * 4),
          fps: FPS,
          config: { damping: 16 },
        });

        return (
          <div
            key={name}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `translate(-50%, -50%) scale(${scale * entrance})`,
              fontSize: 13,
              fontWeight: 500,
              color: COLORS.primary,
              fontFamily: "system-ui, -apple-system, sans-serif",
              opacity: opacity * entrance,
              whiteSpace: "nowrap",
              zIndex: Math.round(depth * 100),
              letterSpacing: "0.02em",
              textShadow: depth > 0.7 ? `0 0 12px ${COLORS.primary}30` : undefined,
            }}
          >
            {name}
          </div>
        );
      })}
    </>
  );
};

const InstallBadge: React.FC<{
  text: string;
  startFrame: number;
  frame: number;
  color: string;
  icon: string;
}> = ({ text, startFrame, frame, color, icon }) => {
  const s = spring({
    frame: Math.max(0, frame - startFrame),
    fps: FPS,
    config: { damping: 16, mass: 0.6 },
  });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 22px",
        background: `${color}0a`,
        border: `1px solid ${color}25`,
        borderRadius: 8,
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        fontSize: 16,
        color,
        opacity: s,
        transform: `translateY(${(1 - s) * 16}px)`,
        boxShadow: `0 2px 12px ${color}10`,
      }}
    >
      <span style={{ opacity: 0.5, fontSize: 14 }}>{icon}</span>
      {text}
    </div>
  );
};
