// Global delay and reverb for the exported project.
//
// The Tracker has one send delay and one send reverb shared by all tracks.
// Both ship muted at zero volume, so per-instrument sends do nothing until
// these are set — which is why exports used to arrive completely dry even
// though the format has had the fields all along.
//
// Units verified by round-tripping through Project.write / Project.parse:
//   delayFeedback, delayVolume, reverbVolume  0..100
//   delayTime                                 milliseconds
//   delayMute, reverbMute                     0 | 1
//   reverb                                    { size, damp, predelay, diffusion } as 0..1
//
// tracker-lib does NOT range-check these: writing 200 stored 200, and writing
// 300 wrapped to 44. Every value here is clamped before it is handed over.
import type { Song, VibeName } from '../engine/types';

export interface ProjectMixSettings {
  delayFeedback: number;
  delayTime: number;
  delayVolume: number;
  delayMute: number;
  reverb: { size: number; damp: number; predelay: number; diffusion: number };
  reverbVolume: number;
  reverbMute: number;
}

interface VibeSpace {
  /** Delay length as a fraction of a beat: 0.75 = dotted eighth, 0.5 = eighth. */
  delayBeats: number;
  feedback: number;
  delayVolume: number;
  reverbVolume: number;
  size: number;
  damp: number;
}

// Defaults aim for "audible but not the point". Dub is the deliberate
// exception: the send section is the genre.
const DEFAULT_SPACE: VibeSpace = {
  delayBeats: 0.75, feedback: 35, delayVolume: 30, reverbVolume: 30, size: 0.5, damp: 0.5,
};

const VIBE_SPACE: Partial<Record<VibeName, Partial<VibeSpace>>> = {
  dub:        { delayBeats: 0.75, feedback: 70, delayVolume: 65, reverbVolume: 50, size: 0.8, damp: 0.35 },
  dungeon:    { delayBeats: 1,    feedback: 45, delayVolume: 35, reverbVolume: 60, size: 0.85, damp: 0.6 },
  lofi:       { delayBeats: 0.5,  feedback: 30, delayVolume: 28, reverbVolume: 40, size: 0.6, damp: 0.7 },
  synthwave:  { delayBeats: 0.75, feedback: 45, delayVolume: 40, reverbVolume: 40, size: 0.7, damp: 0.4 },
  idm:        { delayBeats: 0.375, feedback: 50, delayVolume: 35, reverbVolume: 30, size: 0.5, damp: 0.5 },
  titleScreen:{ delayBeats: 0.75, feedback: 40, delayVolume: 35, reverbVolume: 45, size: 0.75, damp: 0.45 },
  techno:     { delayBeats: 0.75, feedback: 40, delayVolume: 30, reverbVolume: 25, size: 0.5, damp: 0.5 },
  dnb:        { delayBeats: 0.375, feedback: 35, delayVolume: 25, reverbVolume: 25, size: 0.55, damp: 0.5 },
  // Dry by identity — these genres do not want a wash behind them.
  punk:       { feedback: 20, delayVolume: 10, reverbVolume: 12, size: 0.35, damp: 0.6 },
  hardcore:   { feedback: 25, delayVolume: 12, reverbVolume: 15, size: 0.4, damp: 0.55 },
  funk:       { feedback: 25, delayVolume: 15, reverbVolume: 18, size: 0.4, damp: 0.55 },
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const clamp100 = (value: number) => Math.round(clamp(value, 0, 100));

const clamp01 = (value: number) => clamp(value, 0, 1);

/** Delay time in ms for a fraction of a beat at this tempo, capped to the device's range. */
function delayTimeMs(bpm: number, beats: number): number {
  const msPerBeat = 60000 / Math.max(1, bpm);
  return Math.round(clamp(msPerBeat * beats, 1, 2000));
}

export function projectMixSettings(song: Song): ProjectMixSettings {
  const space = { ...DEFAULT_SPACE, ...(VIBE_SPACE[song.config.vibe] ?? {}) };

  return {
    // Tempo-synced rather than a fixed 500ms: a delay that lands off the grid
    // reads as a mistake, and the exporter is the only place that knows the BPM.
    delayTime: delayTimeMs(song.config.bpm, space.delayBeats),
    delayFeedback: clamp100(space.feedback),
    delayVolume: clamp100(space.delayVolume),
    delayMute: 0,
    reverb: {
      size: clamp01(space.size),
      damp: clamp01(space.damp),
      predelay: 0.3,
      diffusion: 0.68,
    },
    reverbVolume: clamp100(space.reverbVolume),
    reverbMute: 0,
  };
}
