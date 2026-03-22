import React from "react";
import { useCurrentFrame, spring } from "remotion";
import { FPS } from "../constants/timing";
import { COLORS } from "../constants/colors";

export interface Step {
  number: number;
  label: string;
  /** Optional icon (SVG component or ReactNode) */
  icon?: React.ReactNode;
  color?: string;
}

interface StepFlowProps {
  steps: Step[];
  /** Frame at which first step appears */
  startFrame: number;
  /** Frames between each step reveal */
  stagger?: number;
  /** Which step is currently active (1-indexed, 0=none) */
  activeStep?: number;
  /** "horizontal" or "vertical" */
  direction?: "horizontal" | "vertical";
  /** Overall style */
  style?: React.CSSProperties;
}

export const StepFlow: React.FC<StepFlowProps> = ({
  steps,
  startFrame,
  stagger = 20,
  activeStep = 0,
  direction = "horizontal",
  style = {},
}) => {
  const frame = useCurrentFrame();

  const isHorizontal = direction === "horizontal";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isHorizontal ? "row" : "column",
        alignItems: "center",
        gap: 0,
        ...style,
      }}
    >
      {steps.map((step, i) => {
        const stepDelay = startFrame + i * stagger;
        const s = spring({
          frame: Math.max(0, frame - stepDelay),
          fps: FPS,
          config: { damping: 16, mass: 0.6 },
        });

        const isActive = activeStep >= step.number;
        const isCurrent = activeStep === step.number;
        const color = step.color ?? COLORS.primary;
        const isLast = i === steps.length - 1;

        return (
          <React.Fragment key={step.number}>
            {/* Step node */}
            <div
              style={{
                display: "flex",
                flexDirection: isHorizontal ? "column" : "row",
                alignItems: "center",
                gap: isHorizontal ? 8 : 10,
                opacity: s,
                transform: isHorizontal
                  ? `translateY(${(1 - s) * 15}px)`
                  : `translateX(${(1 - s) * 15}px)`,
              }}
            >
              {/* Circle with number/icon */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: "'SF Mono', monospace",
                  color: isActive ? COLORS.bg : color,
                  background: isActive ? color : "transparent",
                  border: `2px solid ${isActive ? color : `${color}40`}`,
                  boxShadow: isCurrent
                    ? `0 0 16px ${color}40, 0 0 32px ${color}15`
                    : isActive
                      ? `0 0 8px ${color}20`
                      : "none",
                  transition: "all 0.3s",
                }}
              >
                {step.icon ?? step.number}
              </div>

              {/* Label */}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? COLORS.white : COLORS.muted,
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                  textAlign: "center",
                  maxWidth: 100,
                }}
              >
                {step.label}
              </div>
            </div>

            {/* Connector line between steps */}
            {!isLast && (
              <StepConnector
                frame={frame}
                startFrame={stepDelay + stagger * 0.5}
                isActive={activeStep > step.number}
                color={color}
                horizontal={isHorizontal}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ── Connector ────────────────────────────────────

const StepConnector: React.FC<{
  frame: number;
  startFrame: number;
  isActive: boolean;
  color: string;
  horizontal: boolean;
}> = ({ frame, startFrame, isActive, color, horizontal }) => {
  const s = spring({
    frame: Math.max(0, frame - startFrame),
    fps: FPS,
    config: { damping: 20, mass: 0.5 },
  });

  if (horizontal) {
    return (
      <div
        style={{
          width: 40,
          height: 2,
          background: `linear-gradient(90deg, ${isActive ? color : `${color}30`}, ${isActive ? color : `${color}15`})`,
          opacity: s,
          margin: "0 4px",
          marginBottom: 24, // offset for label height
          borderRadius: 1,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 2,
        height: 24,
        background: `linear-gradient(180deg, ${isActive ? color : `${color}30`}, ${isActive ? color : `${color}15`})`,
        opacity: s,
        margin: "4px 0",
        marginRight: 24,
        borderRadius: 1,
      }}
    />
  );
};
