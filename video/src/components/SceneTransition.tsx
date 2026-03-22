import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../constants/colors";
import { FADE_FRAMES } from "../constants/timing";

interface SceneTransitionProps {
  /** Total duration of this act in frames */
  duration: number;
  /** Color accent for enter/exit washes */
  enterColor?: string;
  exitColor?: string;
  /** Transition style */
  mode?: "fade" | "zoom" | "wipe" | "blur";
  children: React.ReactNode;
}

/**
 * Wraps an act with cinematic enter/exit transitions.
 * Replaces the simple opacity fade with richer effects.
 */
export const SceneTransition: React.FC<SceneTransitionProps> = ({
  duration,
  enterColor = COLORS.primary,
  exitColor = COLORS.primary,
  mode = "zoom",
  children,
}) => {
  const frame = useCurrentFrame();
  const TF = FADE_FRAMES + 5; // slightly longer transition window

  // Enter progress 0→1
  const enterP = interpolate(frame, [0, TF], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Exit progress 0→1
  const exitP = interpolate(frame, [duration - TF, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Base opacity (shared by all modes)
  const opacity = Math.min(enterP, 1 - exitP);

  // Mode-specific transforms
  let transform = "";
  let filter = "";

  if (mode === "zoom") {
    const enterScale = interpolate(enterP, [0, 1], [1.04, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const exitScale = interpolate(exitP, [0, 1], [1, 0.97], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const scale = frame < duration / 2 ? enterScale : exitScale;
    transform = `scale(${scale})`;
  }

  if (mode === "blur") {
    const enterBlur = interpolate(enterP, [0, 1], [8, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const exitBlur = interpolate(exitP, [0, 1], [0, 6], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const blur = frame < duration / 2 ? enterBlur : exitBlur;
    filter = `blur(${blur}px)`;
  }

  // Color wash overlay (subtle tint during transitions)
  const enterWashOpacity = interpolate(enterP, [0, 0.3, 1], [0.15, 0.08, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitWashOpacity = interpolate(exitP, [0, 0.7, 1], [0, 0.08, 0.12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Content with transition effects */}
      <div
        style={{
          width: 1920,
          height: 1080,
          opacity,
          transform,
          filter: filter || undefined,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>

      {/* Enter color wash */}
      {enterP < 1 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: enterColor,
            opacity: enterWashOpacity,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Exit color wash */}
      {exitP > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: exitColor,
            opacity: exitWashOpacity,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};
