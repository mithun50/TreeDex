import React from "react";
import { useCurrentFrame, spring } from "remotion";
import { FPS } from "../constants/timing";
import { COLORS } from "../constants/colors";

// ── Feature Card (for closing act) ───────────────

export interface Feature {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color?: string;
}

interface FeatureHighlightProps {
  features: Feature[];
  startFrame: number;
  stagger?: number;
  style?: React.CSSProperties;
}

export const FeatureHighlight: React.FC<FeatureHighlightProps> = ({
  features,
  startFrame,
  stagger = 12,
  style = {},
}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        ...style,
      }}
    >
      {features.map((feat, i) => {
        const s = spring({
          frame: Math.max(0, frame - startFrame - i * stagger),
          fps: FPS,
          config: { damping: 16, mass: 0.6 },
        });

        const color = feat.color ?? COLORS.primary;

        return (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "16px 20px",
              background: `${color}08`,
              border: `1px solid ${color}18`,
              borderRadius: 10,
              opacity: s,
              transform: `translateY(${(1 - s) * 20}px)`,
              minWidth: 140,
            }}
          >
            <div style={{ color, display: "flex", alignItems: "center", justifyContent: "center" }}>{feat.icon}</div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color,
                fontFamily: "'SF Mono', monospace",
              }}
            >
              {feat.title}
            </div>
            <div
              style={{
                fontSize: 11,
                color: COLORS.muted,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontFamily: "system-ui, sans-serif",
                textAlign: "center",
              }}
            >
              {feat.subtitle}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Narrator Text (subtitle bar for TTS sync) ────

interface NarratorTextProps {
  text: string;
  startFrame: number;
  endFrame: number;
  style?: React.CSSProperties;
}

export const NarratorText: React.FC<NarratorTextProps> = ({
  text,
  startFrame,
  endFrame,
  style = {},
}) => {
  const frame = useCurrentFrame();

  if (frame < startFrame || frame >= endFrame) return null;

  const localFrame = frame - startFrame;
  const duration = endFrame - startFrame;

  const fadeIn = Math.min(localFrame / 8, 1);
  const fadeOut = Math.min((endFrame - frame) / 8, 1);
  const opacity = Math.min(fadeIn, fadeOut);

  // Progressive word reveal
  const words = text.split(" ");
  const wordsToShow = Math.ceil((localFrame / (duration * 0.6)) * words.length);
  const visibleText = words.slice(0, wordsToShow).join(" ");
  const hiddenText = words.slice(wordsToShow).join(" ");

  return (
    <div
      style={{
        padding: "12px 32px",
        background: `linear-gradient(135deg, ${COLORS.bg}e0, ${COLORS.bg}c0)`,
        borderRadius: 10,
        border: `1px solid ${COLORS.dim}30`,
        backdropFilter: "blur(12px)",
        opacity,
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        boxShadow: `0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)`,
        ...style,
      }}
    >
      {/* Audio waveform indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {[0.4, 0.7, 1, 0.6, 0.3].map((h, i) => (
          <div
            key={i}
            style={{
              width: 2,
              height: 10 * h,
              borderRadius: 1,
              background: COLORS.primary,
              opacity: 0.5 + (localFrame % 20 > i * 4 ? 0.3 : 0),
            }}
          />
        ))}
      </div>
      <div>
        <span
          style={{
            fontSize: 17,
            fontWeight: 400,
            color: COLORS.white,
            fontFamily: "system-ui, -apple-system, sans-serif",
            lineHeight: 1.5,
            letterSpacing: "0.015em",
          }}
        >
          {visibleText}
        </span>
        {hiddenText && (
          <span
            style={{
              fontSize: 17,
              fontWeight: 400,
              color: `${COLORS.muted}50`,
              fontFamily: "system-ui, -apple-system, sans-serif",
              lineHeight: 1.5,
              letterSpacing: "0.015em",
            }}
          >
            {" " + hiddenText}
          </span>
        )}
      </div>
    </div>
  );
};

// ── Comparison Badge (VS indicator) ──────────────

interface ComparisonProps {
  leftLabel: string;
  rightLabel: string;
  leftColor?: string;
  rightColor?: string;
  startFrame: number;
  style?: React.CSSProperties;
}

export const ComparisonBadge: React.FC<ComparisonProps> = ({
  leftLabel,
  rightLabel,
  leftColor = COLORS.chaosRed,
  rightColor = COLORS.success,
  startFrame,
  style = {},
}) => {
  const frame = useCurrentFrame();
  const s = spring({
    frame: Math.max(0, frame - startFrame),
    fps: FPS,
    config: { damping: 16, mass: 0.6 },
  });

  if (s < 0.01) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        opacity: s,
        transform: `scale(${0.9 + s * 0.1})`,
        ...style,
      }}
    >
      <div
        style={{
          padding: "6px 14px",
          background: `${leftColor}15`,
          border: `1px solid ${leftColor}30`,
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          color: leftColor,
          fontFamily: "system-ui, sans-serif",
          textDecoration: "line-through",
          textDecorationColor: `${leftColor}60`,
        }}
      >
        {leftLabel}
      </div>
      <div
        style={{
          fontSize: 11,
          color: COLORS.muted,
          fontWeight: 700,
          letterSpacing: "0.05em",
        }}
      >
        VS
      </div>
      <div
        style={{
          padding: "6px 14px",
          background: `${rightColor}15`,
          border: `1px solid ${rightColor}30`,
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          color: rightColor,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {rightLabel}
      </div>
    </div>
  );
};
