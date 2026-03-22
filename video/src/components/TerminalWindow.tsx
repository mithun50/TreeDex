import React from "react";
import { useCurrentFrame, spring, interpolate } from "remotion";
import { FPS } from "../constants/timing";
import { TERM, COLORS } from "../constants/colors";

export interface TerminalLine {
  text: string;
  type: "command" | "output" | "success" | "error" | "blank";
  /** Frame (local) at which this line starts appearing */
  startFrame: number;
  /** Frames to type (only for 'command' type; output appears instantly) */
  typeDuration?: number;
}

interface TerminalWindowProps {
  lines: TerminalLine[];
  title?: string;
  width?: number;
  height?: number;
  /** Frame at which the terminal window enters */
  entranceFrame?: number;
  style?: React.CSSProperties;
}

export const TerminalWindow: React.FC<TerminalWindowProps> = ({
  lines,
  title = "Terminal",
  width = 900,
  height,
  entranceFrame = 0,
  style = {},
}) => {
  const frame = useCurrentFrame();

  // Spring entrance with gentle overshoot
  const entrance = spring({
    frame: Math.max(0, frame - entranceFrame),
    fps: FPS,
    config: { damping: 16, mass: 0.7, stiffness: 120 },
  });

  // Subtle ambient glow that breathes
  const glowPulse = 0.3 + 0.1 * Math.sin(frame * 0.03);

  return (
    <div
      style={{
        width,
        height: height ?? "auto",
        background: TERM.bg,
        border: `1px solid ${TERM.border}`,
        borderRadius: 12,
        overflow: "hidden",
        opacity: entrance,
        transform: `translateY(${(1 - entrance) * 24}px) scale(${0.97 + entrance * 0.03})`,
        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
        boxShadow: `
          0 0 0 1px ${TERM.border},
          0 8px 32px rgba(0,0,0,0.5),
          0 2px 8px rgba(0,0,0,0.3),
          inset 0 1px 0 rgba(255,255,255,0.03),
          0 0 60px ${COLORS.primary}${Math.round(glowPulse * 15).toString(16).padStart(2, "0")}
        `,
        ...style,
      }}
    >
      {/* Title bar — realistic macOS style */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "11px 16px",
          background: `linear-gradient(180deg, ${TERM.titleBar}, ${TERM.bg})`,
          borderBottom: `1px solid ${TERM.border}`,
          position: "relative",
        }}
      >
        {/* Traffic lights with inner shadows for realism */}
        <TrafficLight color={TERM.trafficRed} innerShadow="#bf3f3a" />
        <TrafficLight color={TERM.trafficYellow} innerShadow="#c09020" />
        <TrafficLight color={TERM.trafficGreen} innerShadow="#1fa030" />

        {/* Title centered */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 12,
            color: TERM.output,
            fontWeight: 500,
            letterSpacing: "0.02em",
            opacity: 0.7,
          }}
        >
          {title}
        </div>
      </div>

      {/* Terminal body */}
      <div
        style={{
          padding: "16px 20px 20px",
          minHeight: 120,
          background: `linear-gradient(180deg, ${TERM.bg} 0%, #0a0f18 100%)`,
        }}
      >
        {lines.map((line, i) => (
          <TerminalLineRenderer key={i} line={line} frame={frame} lineIndex={i} />
        ))}
        {/* Blinking cursor on its own line */}
        <BlinkingCursor frame={frame} lines={lines} />
      </div>
    </div>
  );
};

// ── Traffic Light Button ─────────────────────────

const TrafficLight: React.FC<{ color: string; innerShadow: string }> = ({
  color,
  innerShadow,
}) => (
  <div
    style={{
      width: 12,
      height: 12,
      borderRadius: "50%",
      background: `radial-gradient(circle at 30% 30%, ${color}, ${innerShadow})`,
      boxShadow: `inset 0 -1px 2px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1)`,
    }}
  />
);

// ── Line Renderer ────────────────────────────────

const TerminalLineRenderer: React.FC<{
  line: TerminalLine;
  frame: number;
  lineIndex: number;
}> = ({ line, frame, lineIndex }) => {
  const localFrame = frame - line.startFrame;
  if (localFrame < 0) return null;

  if (line.type === "blank") {
    return <div style={{ height: 8 }} />;
  }

  const isCommand = line.type === "command";
  const typeDur = line.typeDuration ?? 30;

  // For commands: progressive character reveal
  // For output: fade in quickly
  const outputFade = isCommand ? 1 : Math.min(localFrame / 5, 1);

  let displayText: string;
  let rawText: string;

  if (isCommand) {
    const isShell = line.text.startsWith("$");
    const isPython = line.text.startsWith(">>>");
    rawText = isShell
      ? line.text.replace(/^\$\s*/, "")
      : isPython
        ? line.text.replace(/^>>>\s*/, "")
        : line.text;
    const charsToShow = Math.min(
      Math.floor((localFrame / typeDur) * rawText.length),
      rawText.length,
    );
    displayText = rawText.slice(0, charsToShow);
  } else {
    rawText = line.text;
    displayText = line.text;
  }

  const colorMap: Record<TerminalLine["type"], string> = {
    command: TERM.command,
    output: TERM.output,
    success: TERM.success,
    error: TERM.error,
    blank: "transparent",
  };

  // Error lines get a subtle background
  const isError = line.type === "error";
  const isSuccess = line.type === "success";

  return (
    <div
      style={{
        fontSize: 14,
        lineHeight: 1.75,
        color: colorMap[line.type],
        whiteSpace: "pre-wrap",
        opacity: outputFade,
        padding: isError ? "1px 6px" : isSuccess ? "0 2px" : undefined,
        borderRadius: isError ? 3 : undefined,
        background: isError ? `${TERM.error}10` : undefined,
        borderLeft: isError
          ? `2px solid ${TERM.error}40`
          : isSuccess
            ? `2px solid ${TERM.success}30`
            : undefined,
        marginLeft: isError || isSuccess ? -2 : undefined,
      }}
    >
      {isCommand && (
        <span
          style={{
            color: TERM.prompt,
            fontWeight: 600,
            userSelect: "none",
          }}
        >
          {line.text.startsWith(">>>") ? ">>> " : "$ "}
        </span>
      )}
      <span>{displayText}</span>
      {/* Inline typing cursor for commands still typing */}
      {isCommand && displayText.length < rawText.length && (
        <span
          style={{
            display: "inline-block",
            width: 7,
            height: 15,
            backgroundColor: TERM.cursor,
            opacity: Math.floor(frame / 12) % 2 === 0 ? 0.9 : 0,
            verticalAlign: "text-bottom",
            marginLeft: 1,
            borderRadius: 1,
          }}
        />
      )}
    </div>
  );
};

// ── Blinking Cursor ──────────────────────────────

const BlinkingCursor: React.FC<{ frame: number; lines: TerminalLine[] }> = ({
  frame,
  lines,
}) => {
  // Only show standalone cursor after last line is fully typed
  const lastLine = lines[lines.length - 1];
  if (!lastLine) return null;

  const lastLocalFrame = frame - lastLine.startFrame;
  const isLastCommand = lastLine.type === "command";
  const typeDur = lastLine.typeDuration ?? 30;
  const lastLineComplete = isLastCommand ? lastLocalFrame >= typeDur : lastLocalFrame >= 5;

  if (!lastLineComplete) return null;

  const visible = Math.floor(frame / 15) % 2 === 0;
  const lastIsShell = lastLine.text.startsWith("$") || lastLine.type !== "command";
  const prompt = lastIsShell ? "$ " : ">>> ";

  return (
    <div style={{ fontSize: 14, lineHeight: 1.75 }}>
      <span style={{ color: TERM.prompt, fontWeight: 600 }}>{prompt}</span>
      <span
        style={{
          display: "inline-block",
          width: 7,
          height: 15,
          backgroundColor: TERM.cursor,
          opacity: visible ? 0.85 : 0,
          verticalAlign: "text-bottom",
          borderRadius: 1,
        }}
      />
    </div>
  );
};
