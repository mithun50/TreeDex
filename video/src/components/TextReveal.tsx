import React from "react";
import { useCurrentFrame, spring } from "remotion";
import { FPS } from "../constants/timing";
import { COLORS } from "../constants/colors";

type RevealMode = "fade" | "slideUp" | "typewriter" | "scaleUp" | "wordByWord" | "glowFade" | "letterReveal" | "splitLine";

interface TextRevealProps {
  text: string;
  startFrame: number;
  duration?: number;
  mode?: RevealMode;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  fontWeight?: number;
  style?: React.CSSProperties;
  letterSpacing?: string;
}

export const TextReveal: React.FC<TextRevealProps> = ({
  text,
  startFrame,
  duration = 60,
  mode = "fade",
  fontSize = 48,
  color = COLORS.white,
  fontFamily = "system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontWeight = 600,
  style = {},
  letterSpacing,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  if (localFrame < 0) return null;

  const progress = Math.min(localFrame / duration, 1);

  const baseStyle: React.CSSProperties = {
    fontSize,
    color,
    fontFamily,
    fontWeight,
    letterSpacing,
    whiteSpace: "pre-wrap",
    lineHeight: 1.2,
    ...style,
  };

  if (mode === "fade") {
    // Smooth ease-out opacity
    const t = Math.min(progress * 1.5, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    return (
      <div style={{ ...baseStyle, opacity: eased }}>
        {text}
      </div>
    );
  }

  if (mode === "slideUp") {
    const s = spring({
      frame: localFrame,
      fps: FPS,
      config: { damping: 18, mass: 0.7, stiffness: 100 },
    });
    return (
      <div
        style={{
          ...baseStyle,
          opacity: s,
          transform: `translateY(${(1 - s) * 30}px)`,
          filter: `blur(${(1 - s) * 2}px)`,
        }}
      >
        {text}
      </div>
    );
  }

  if (mode === "typewriter") {
    const charsToShow = Math.floor(progress * text.length);
    const showCursor = Math.floor(frame / 12) % 2 === 0;
    return (
      <div style={baseStyle}>
        <span>{text.slice(0, charsToShow)}</span>
        {charsToShow < text.length && (
          <span
            style={{
              display: "inline-block",
              width: "0.55em",
              height: "1.1em",
              backgroundColor: color,
              opacity: showCursor ? 0.7 : 0,
              verticalAlign: "text-bottom",
              marginLeft: 1,
              borderRadius: 1,
            }}
          />
        )}
      </div>
    );
  }

  if (mode === "scaleUp") {
    const s = spring({
      frame: localFrame,
      fps: FPS,
      config: { damping: 14, mass: 0.5, stiffness: 100 },
    });
    return (
      <div
        style={{
          ...baseStyle,
          opacity: s,
          transform: `scale(${0.6 + s * 0.4})`,
          filter: `blur(${(1 - s) * 4}px)`,
        }}
      >
        {text}
      </div>
    );
  }

  if (mode === "glowFade") {
    const t = Math.min(progress * 1.5, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const glowIntensity = Math.max(0, 1 - progress * 2) * 40;
    return (
      <div
        style={{
          ...baseStyle,
          opacity: eased,
          textShadow: `0 0 ${glowIntensity}px ${color}, 0 0 ${glowIntensity * 2}px ${color}40`,
        }}
      >
        {text}
      </div>
    );
  }

  if (mode === "wordByWord") {
    const words = text.split(" ");
    return (
      <div
        style={{
          ...baseStyle,
          display: "flex",
          flexWrap: "wrap",
          gap: "0.3em",
          justifyContent: "center",
        }}
      >
        {words.map((word, i) => {
          const wordDelay = (i / words.length) * duration * 0.7;
          const wordLocal = localFrame - wordDelay;
          const s =
            wordLocal <= 0
              ? 0
              : spring({
                  frame: wordLocal,
                  fps: FPS,
                  config: { damping: 16, mass: 0.6 },
                });
          return (
            <span
              key={i}
              style={{
                opacity: s,
                transform: `translateY(${(1 - s) * 15}px)`,
                display: "inline-block",
                filter: `blur(${(1 - s) * 2}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  if (mode === "letterReveal") {
    const letters = text.split("");
    return (
      <div
        style={{
          ...baseStyle,
          display: "flex",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {letters.map((letter, i) => {
          const letterDelay = (i / letters.length) * duration * 0.5;
          const letterLocal = localFrame - letterDelay;
          const s =
            letterLocal <= 0
              ? 0
              : spring({
                  frame: letterLocal,
                  fps: FPS,
                  config: { damping: 12, mass: 0.5, stiffness: 120 },
                });
          return (
            <span
              key={i}
              style={{
                opacity: s,
                transform: `translateY(${(1 - s) * 40}px)`,
                display: "inline-block",
                minWidth: letter === " " ? "0.3em" : undefined,
              }}
            >
              {letter}
            </span>
          );
        })}
      </div>
    );
  }

  if (mode === "splitLine") {
    // Text splits from center — left half slides left, right slides right
    const mid = Math.ceil(text.length / 2);
    const left = text.slice(0, mid);
    const right = text.slice(mid);
    const s = spring({
      frame: localFrame,
      fps: FPS,
      config: { damping: 16, mass: 0.6 },
    });
    return (
      <div style={{ ...baseStyle, display: "flex", justifyContent: "center", overflow: "hidden" }}>
        <span
          style={{
            opacity: s,
            transform: `translateX(${(1 - s) * -40}px)`,
            display: "inline-block",
          }}
        >
          {left}
        </span>
        <span
          style={{
            opacity: s,
            transform: `translateX(${(1 - s) * 40}px)`,
            display: "inline-block",
          }}
        >
          {right}
        </span>
      </div>
    );
  }

  return <div style={baseStyle}>{text}</div>;
};
