import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS } from "../constants/colors";

interface GlowOrbProps {
  x: number;
  y: number;
  size?: number;
  color?: string;
  pulseSpeed?: number;
  opacity?: number;
}

export const GlowOrb: React.FC<GlowOrbProps> = ({
  x,
  y,
  size = 200,
  color = COLORS.primary,
  pulseSpeed = 0.04,
  opacity = 0.4,
}) => {
  const frame = useCurrentFrame();

  // Multi-frequency pulse for organic feel
  const pulse1 = Math.sin(frame * pulseSpeed) * 0.12;
  const pulse2 = Math.sin(frame * pulseSpeed * 1.7 + 1) * 0.06;
  const scale = 0.88 + pulse1 + pulse2;

  const opHex = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");
  const opHalf = Math.round(opacity * 128)
    .toString(16)
    .padStart(2, "0");

  return (
    <>
      {/* Outer soft glow */}
      <div
        style={{
          position: "absolute",
          left: x - size * 0.75,
          top: y - size * 0.75,
          width: size * 1.5,
          height: size * 1.5,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}${opHalf}, transparent 65%)`,
          transform: `scale(${scale * 1.1})`,
          pointerEvents: "none",
        }}
      />
      {/* Inner concentrated glow */}
      <div
        style={{
          position: "absolute",
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}${opHex}, ${color}${opHalf} 40%, transparent 70%)`,
          transform: `scale(${scale})`,
          pointerEvents: "none",
        }}
      />
    </>
  );
};
