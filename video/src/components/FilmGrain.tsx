import React from "react";
import { useCurrentFrame } from "remotion";

interface FilmGrainProps {
  opacity?: number;
  /** Grain refresh speed — lower = slower grain update */
  speed?: number;
}

/**
 * SVG-based film grain overlay.
 * Uses feTurbulence seeded by frame for animated noise.
 */
export const FilmGrain: React.FC<FilmGrainProps> = ({
  opacity = 0.035,
  speed = 3,
}) => {
  const frame = useCurrentFrame();
  // Change seed every N frames for grain flicker
  const seed = Math.floor(frame / speed);

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 999,
        mixBlendMode: "overlay",
        opacity,
      }}
    >
      <filter id={`grain-${seed}`}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.65"
          numOctaves={3}
          seed={seed}
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect
        width="100%"
        height="100%"
        filter={`url(#grain-${seed})`}
      />
    </svg>
  );
};
