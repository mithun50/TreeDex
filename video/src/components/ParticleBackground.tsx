import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { COLORS } from "../constants/colors";

interface ParticleBackgroundProps {
  count?: number;
  /** 0 = scattered, 1 = converged to center */
  coalescence?: number;
  width?: number;
  height?: number;
  color?: string;
}

interface Particle {
  id: number;
  startX: number;
  startY: number;
  size: number;
  speed: number;
  phase: number;
  /** Orbit radius around center when coalesced */
  orbitRadius: number;
  orbitSpeed: number;
  /** 0=round, 1=diamond, 2=line */
  shape: number;
  /** Depth layer: 0=far, 1=mid, 2=near */
  layer: number;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export const ParticleBackground: React.FC<ParticleBackgroundProps> = ({
  count = 150,
  coalescence = 0,
  width = 1920,
  height = 1080,
  color = COLORS.primary,
}) => {
  const frame = useCurrentFrame();

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: count }, (_, i) => {
      const layer = i < count * 0.3 ? 0 : i < count * 0.7 ? 1 : 2;
      return {
        id: i,
        startX: seededRandom(i * 3 + 1) * width,
        startY: seededRandom(i * 3 + 2) * height,
        size: [1, 2, 3.5][layer] + seededRandom(i * 3 + 3) * [0.5, 1, 2][layer],
        speed: [0.2, 0.5, 0.8][layer] + seededRandom(i * 7) * 0.3,
        phase: seededRandom(i * 11) * Math.PI * 2,
        orbitRadius: 20 + seededRandom(i * 13) * 180,
        orbitSpeed: (seededRandom(i * 17) - 0.5) * 0.015,
        shape: Math.floor(seededRandom(i * 19) * 3),
        layer,
      };
    });
  }, [count, width, height]);

  const centerX = width / 2;
  const centerY = height / 2;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {particles.map((p) => {
        // Layered parallax float
        const parallax = [0.3, 0.6, 1.0][p.layer];
        const floatX =
          p.startX +
          Math.sin(frame * 0.018 * p.speed * parallax + p.phase) * 40 * parallax;
        const floatY =
          p.startY +
          Math.cos(frame * 0.013 * p.speed * parallax + p.phase + 0.5) * 30 * parallax;

        // When coalescing: orbit around center instead of static converge
        const orbitAngle = frame * p.orbitSpeed + p.phase;
        const orbitX = centerX + Math.cos(orbitAngle) * p.orbitRadius * (1 - coalescence * 0.7);
        const orbitY = centerY + Math.sin(orbitAngle) * p.orbitRadius * 0.6 * (1 - coalescence * 0.7);

        // Blend between scattered and orbiting
        const x = floatX + (orbitX - floatX) * coalescence;
        const y = floatY + (orbitY - floatY) * coalescence;

        // Layered opacity
        const baseOpacity = [0.15, 0.3, 0.55][p.layer];
        const breathe = 0.15 * Math.sin(frame * 0.025 + p.phase);
        const coalesceBoost = coalescence * 0.2;
        const opacity = Math.max(0, Math.min(1, baseOpacity + breathe + coalesceBoost));

        // Size grows slightly when near center
        const dist = Math.sqrt(
          (x - centerX) * (x - centerX) + (y - centerY) * (y - centerY),
        );
        const proxBoost = Math.max(0, 1 - dist / 500) * coalescence * 2;
        const size = p.size + proxBoost;

        const glowSize = size * [2, 3, 4][p.layer];

        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              borderRadius: p.shape === 1 ? 1 : "50%",
              transform: p.shape === 1 ? "rotate(45deg)" : undefined,
              backgroundColor: color,
              opacity,
              boxShadow: `0 0 ${glowSize}px ${color}50, 0 0 ${glowSize * 0.3}px ${color}30`,
            }}
          />
        );
      })}

      {/* Central glow that intensifies with coalescence */}
      {coalescence > 0.1 && (
        <div
          style={{
            position: "absolute",
            left: centerX - 300,
            top: centerY - 300,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${color}${Math.round(coalescence * 20).toString(16).padStart(2, "0")}, transparent 70%)`,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};
