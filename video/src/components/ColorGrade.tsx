import React from "react";

interface ColorGradeProps {
  /** Slight hue tint — "cool" (blue), "warm" (amber), "neutral" */
  tone?: "cool" | "warm" | "neutral";
  /** Contrast boost 0..1 */
  contrast?: number;
  /** Vignette darkness 0..1 */
  vignette?: number;
}

/**
 * Cinematic color grading overlay.
 * Applies subtle color correction + vignette for film-like feel.
 */
export const ColorGrade: React.FC<ColorGradeProps> = ({
  tone = "cool",
  contrast = 0.05,
  vignette = 0.35,
}) => {
  const toneColor =
    tone === "cool"
      ? "rgba(60, 120, 200, 0.04)"
      : tone === "warm"
        ? "rgba(200, 150, 80, 0.04)"
        : "transparent";

  return (
    <>
      {/* Color tone overlay */}
      {tone !== "neutral" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: toneColor,
            mixBlendMode: "color",
            pointerEvents: "none",
            zIndex: 998,
          }}
        />
      )}

      {/* Contrast boost via mix-blend */}
      {contrast > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            mixBlendMode: "soft-light",
            opacity: contrast,
            pointerEvents: "none",
            zIndex: 998,
          }}
        />
      )}

      {/* Cinematic vignette */}
      {vignette > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,${vignette}) 100%)`,
            pointerEvents: "none",
            zIndex: 997,
          }}
        />
      )}
    </>
  );
};
