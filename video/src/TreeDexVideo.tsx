import React from "react";
import { AbsoluteFill, Audio as RawAudio, Sequence, Series, interpolate, staticFile } from "remotion";

// Remotion 3.3.102 + React 18 types require placeholder prop — cast to bypass
const Audio = RawAudio as unknown as React.FC<{
  src: string;
  volume?: number | ((frame: number) => number);
  startFrom?: number;
  endAt?: number;
  playbackRate?: number;
}>;
import { Act1Hero } from "./scenes/Act1Hero";
import { Act2Problem } from "./scenes/Act2Problem";
import { Act3Solution } from "./scenes/Act3Solution";
import { Act4Query } from "./scenes/Act4Query";
import { Act5Closing } from "./scenes/Act5Closing";
import { ACT_DURATIONS, TOTAL_FRAMES, WIDTH, HEIGHT } from "./constants/timing";
import { COLORS } from "./constants/colors";
import { SceneTransition } from "./components/SceneTransition";
import { FilmGrain } from "./components/FilmGrain";
import { ColorGrade } from "./components/ColorGrade";

// ── Global frame offsets for audio placement ──────
const ACT_STARTS = {
  hero: 0,
  problem: ACT_DURATIONS.hero,
  solution: ACT_DURATIONS.hero + ACT_DURATIONS.problem,
  query: ACT_DURATIONS.hero + ACT_DURATIONS.problem + ACT_DURATIONS.solution,
  closing: ACT_DURATIONS.hero + ACT_DURATIONS.problem + ACT_DURATIONS.solution + ACT_DURATIONS.query,
};

// ── Voiceover tracks — continuous per-act narration ─
const VOICEOVERS = [
  { src: "audio/vo_act1.wav", startFrame: ACT_STARTS.hero + 30, durationFrames: 200 },
  { src: "audio/vo_act2.wav", startFrame: ACT_STARTS.problem + 25, durationFrames: 280 },
  { src: "audio/vo_act3.wav", startFrame: ACT_STARTS.solution + 15, durationFrames: 460 },
  { src: "audio/vo_act4.wav", startFrame: ACT_STARTS.query + 15, durationFrames: 340 },
  { src: "audio/vo_act5.wav", startFrame: ACT_STARTS.closing + 20, durationFrames: 300 },
];

// ── Background music volume ducking ───────────────
function useBgmVolume(): (f: number) => number {
  return (f: number) => {
    // Base volume
    let vol = 0.15;

    // Duck during voiceover
    for (const vo of VOICEOVERS) {
      if (f >= vo.startFrame && f < vo.startFrame + vo.durationFrames) {
        vol = 0.05;
        break;
      }
    }

    // Fade in (first 3s = 90 frames)
    const fadeIn = interpolate(f, [0, 90], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    // Fade out (last 3s = 90 frames)
    const fadeOut = interpolate(f, [TOTAL_FRAMES - 90, TOTAL_FRAMES], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    return vol * fadeIn * fadeOut;
  };
}

export const TreeDexVideo: React.FC = () => {
  const bgmVolume = useBgmVolume();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        width: WIDTH,
        height: HEIGHT,
        overflow: "hidden",
      }}
    >
      {/* ── Visual scenes ── */}
      <Series>
        <Series.Sequence durationInFrames={ACT_DURATIONS.hero}>
          <SceneTransition duration={ACT_DURATIONS.hero} enterColor={COLORS.primary} exitColor={COLORS.accent} mode="zoom">
            <Act1Hero />
          </SceneTransition>
        </Series.Sequence>

        <Series.Sequence durationInFrames={ACT_DURATIONS.problem}>
          <SceneTransition duration={ACT_DURATIONS.problem} enterColor={COLORS.chaosRed} exitColor={COLORS.chaosRed} mode="blur">
            <Act2Problem />
          </SceneTransition>
        </Series.Sequence>

        <Series.Sequence durationInFrames={ACT_DURATIONS.solution}>
          <SceneTransition duration={ACT_DURATIONS.solution} enterColor={COLORS.primary} exitColor={COLORS.success} mode="zoom">
            <Act3Solution />
          </SceneTransition>
        </Series.Sequence>

        <Series.Sequence durationInFrames={ACT_DURATIONS.query}>
          <SceneTransition duration={ACT_DURATIONS.query} enterColor={COLORS.success} exitColor={COLORS.accent} mode="zoom">
            <Act4Query />
          </SceneTransition>
        </Series.Sequence>

        <Series.Sequence durationInFrames={ACT_DURATIONS.closing}>
          <SceneTransition duration={ACT_DURATIONS.closing} enterColor={COLORS.primary} exitColor={COLORS.bg} mode="fade">
            <Act5Closing />
          </SceneTransition>
        </Series.Sequence>
      </Series>

      {/* ── Background music ── */}
      <Audio
        src={staticFile("audio/bgm_ambient.wav")}
        volume={bgmVolume}
      />

      {/* ── Voiceover tracks ── */}
      {VOICEOVERS.map((vo, i) => (
        <Sequence key={i} from={vo.startFrame} durationInFrames={vo.durationFrames}>
          <Audio
            src={staticFile(vo.src)}
            volume={0.9}
          />
        </Sequence>
      ))}

      {/* ── Global cinematic overlays ── */}
      <FilmGrain opacity={0.03} speed={3} />
      <ColorGrade tone="cool" contrast={0.05} vignette={0.3} />
    </AbsoluteFill>
  );
};
