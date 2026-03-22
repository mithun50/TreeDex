import React from "react";
import { useCurrentFrame, spring } from "remotion";
import { FPS } from "../constants/timing";
import { COLORS, TERM } from "../constants/colors";
import { IconHash } from "./Icons";

interface FloatingCardsProps {
  /** 0..1 progress for floating phase */
  floatProgress: number;
  /** 0..1 progress for shatter phase */
  shatterProgress: number;
  width?: number;
  height?: number;
}

const CARDS = [
  { title: "chunk_07", lines: [0.85, 0.6, 0.9, 0.45, 0.7, 0.8] },
  { title: "chunk_12", lines: [0.7, 0.9, 0.5, 0.8, 0.6, 0.75] },
  { title: "chunk_23", lines: [0.6, 0.8, 0.7, 0.55, 0.9, 0.65] },
  { title: "chunk_31", lines: [0.9, 0.5, 0.75, 0.8, 0.6, 0.7] },
  { title: "chunk_38", lines: [0.75, 0.85, 0.6, 0.7, 0.5, 0.9] },
  { title: "chunk_41", lines: [0.55, 0.7, 0.85, 0.6, 0.8, 0.65] },
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export const FloatingCards: React.FC<FloatingCardsProps> = ({
  floatProgress,
  shatterProgress,
  width = 700,
  height = 600,
}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
      }}
    >
      {/* Connection lines between cards (showing lack of structure) */}
      {floatProgress > 0.3 && shatterProgress < 0.5 && (
        <svg
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          width={width}
          height={height}
        >
          {[0, 1, 2, 3, 4].map((i) => {
            const opacity = (1 - shatterProgress) * 0.08;
            const x1 = 120 + (i % 3) * 200 + 80;
            const y1 = 120 + Math.floor(i / 3) * 200 + 90;
            const x2 = 120 + ((i + 1) % 3) * 200 + 80;
            const y2 = 120 + Math.floor((i + 1) / 3) * 200 + 90;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={COLORS.chaos}
                strokeWidth={0.5}
                opacity={opacity}
                strokeDasharray="4 6"
              />
            );
          })}
        </svg>
      )}

      {CARDS.map((card, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const baseX = 40 + col * 200;
        const baseY = 80 + row * 200;

        // Staggered entrance
        const entranceS = spring({
          frame: Math.max(0, frame - i * 6),
          fps: FPS,
          config: { damping: 16, mass: 0.6 },
        });

        // Multi-axis float wobble (more organic)
        const t1 = frame * 0.035 + i * 1.3;
        const t2 = frame * 0.028 + i * 0.9;
        const wobbleX = Math.sin(t1) * 12 * floatProgress + Math.sin(t1 * 1.7) * 5 * floatProgress;
        const wobbleY = Math.cos(t2) * 10 * floatProgress + Math.cos(t2 * 1.4) * 4 * floatProgress;
        const wobbleRot = Math.sin(frame * 0.025 + i * 2.1) * 4 * floatProgress;

        // Shatter with physics-like easing
        const shatterAngle = (i / CARDS.length) * Math.PI * 2 + seededRandom(i * 7) * 1.5;
        const shatterEased = shatterProgress * shatterProgress; // Accelerating
        const shatterDist = shatterEased * 800;
        const shatterX = Math.cos(shatterAngle) * shatterDist;
        const shatterY = Math.sin(shatterAngle) * shatterDist - shatterEased * 200;
        const shatterRot = shatterEased * (seededRandom(i * 7) > 0.5 ? 540 : -540);
        const shatterScale = 1 - shatterProgress * 0.5;
        const shatterOpacity = Math.max(0, 1 - shatterProgress * 1.5);

        const x = baseX + wobbleX + shatterX;
        const y = baseY + wobbleY + shatterY;
        const rotation = wobbleRot + shatterRot;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 170,
              height: 175,
              background: `linear-gradient(145deg, ${TERM.bg}, #080d15)`,
              border: `1px solid ${TERM.border}`,
              borderRadius: 10,
              padding: "14px 12px",
              opacity: entranceS * shatterOpacity,
              transform: `rotate(${rotation}deg) scale(${entranceS * shatterScale})`,
              display: "flex",
              flexDirection: "column",
              gap: 5,
              boxShadow: `
                0 4px 16px rgba(0,0,0,0.3),
                0 1px 4px rgba(0,0,0,0.2),
                inset 0 1px 0 rgba(255,255,255,0.03)
              `,
            }}
          >
            {/* Header with icon */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  background: `${COLORS.chaos}25`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  color: COLORS.chaos,
                  fontWeight: 700,
                  fontFamily: "'SF Mono', monospace",
                }}
              >
                <IconHash size={9} color={COLORS.chaos} />
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: COLORS.chaos,
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  letterSpacing: "0.03em",
                }}
              >
                {card.title}
              </div>
            </div>

            {/* Fake text lines with varying opacity */}
            {card.lines.map((w, j) => (
              <div
                key={j}
                style={{
                  height: 6,
                  width: `${w * 100}%`,
                  backgroundColor: COLORS.dim,
                  borderRadius: 3,
                  opacity: 0.5 + j * 0.08,
                }}
              />
            ))}

            {/* Bottom "token" indicator */}
            <div
              style={{
                marginTop: "auto",
                fontSize: 8,
                color: COLORS.muted,
                fontFamily: "'SF Mono', monospace",
                opacity: 0.4,
              }}
            >
              256 tokens
            </div>
          </div>
        );
      })}
    </div>
  );
};
