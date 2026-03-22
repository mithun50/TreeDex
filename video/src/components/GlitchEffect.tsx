import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

interface GlitchEffectProps {
  /** Frame range where glitch is active */
  startFrame: number;
  endFrame: number;
  /** Glitch intensity 0..1 */
  intensity?: number;
  /** Color for chromatic aberration */
  color?: string;
}

/**
 * Overlay that adds digital glitch / interference effect.
 * Horizontal scan bars + chromatic shift + jitter.
 */
export const GlitchEffect: React.FC<GlitchEffectProps> = ({
  startFrame,
  endFrame,
  intensity = 0.5,
  color = "#ff3333",
}) => {
  const frame = useCurrentFrame();

  if (frame < startFrame || frame > endFrame) return null;

  const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Pseudo-random from frame for deterministic glitch
  const seed = Math.sin(frame * 12.9898 + 78.233) * 43758.5453;
  const rand = seed - Math.floor(seed);

  // Only glitch on certain frames for stuttering effect
  const isGlitchFrame = rand > 0.55;
  if (!isGlitchFrame && intensity < 0.8) return null;

  const barCount = 3 + Math.floor(rand * 4);
  const jitterX = (rand - 0.5) * 8 * intensity;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 900,
        mixBlendMode: "screen",
      }}
    >
      {/* Horizontal scan bars */}
      {Array.from({ length: barCount }).map((_, i) => {
        const barSeed = Math.sin((frame + i) * 45.233) * 43758.5453;
        const barRand = barSeed - Math.floor(barSeed);
        const y = barRand * 1080;
        const h = 2 + barRand * 6 * intensity;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: y,
              height: h,
              background: `linear-gradient(90deg, transparent 10%, ${color}${Math.round(intensity * 40).toString(16).padStart(2, "0")} 30%, transparent 70%)`,
              transform: `translateX(${jitterX}px)`,
            }}
          />
        );
      })}

      {/* Chromatic aberration hint — thin colored line at random position */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 100 + rand * 800,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${color}30, cyan, transparent)`,
          opacity: intensity * 0.6,
        }}
      />
    </div>
  );
};
