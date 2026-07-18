// Editable ZzFX parameters, described for the instrument panel.
//
// ZzFX sounds are a flat 20-number array. This module gives the musically
// meaningful slots a label, a safe range and a display format, so the UI can
// render sliders without hardcoding magic indices.
import type { ZzFXSound } from './types';

export const ZZFX_PARAM = {
  volume: 0,
  randomness: 1,
  frequency: 2,
  attack: 3,
  sustain: 4,
  release: 5,
  shape: 6,
  shapeCurve: 7,
  slide: 8,
  deltaSlide: 9,
  pitchJump: 10,
  pitchJumpTime: 11,
  repeatTime: 12,
  noise: 13,
  modulation: 14,
  bitCrush: 15,
  delay: 16,
  sustainVolume: 17,
  decay: 18,
  tremolo: 19,
} as const;

export const SHAPE_NAMES = ['SINE', 'TRIANGLE', 'SAW', 'TAN', 'NOISE', 'SQUARE'];

export type ParamGroup = 'tone' | 'envelope' | 'motion' | 'texture';

export interface ParamDef {
  index: number;
  label: string;
  group: ParamGroup;
  min: number;
  max: number;
  step: number;
  /** Render the raw value for display. */
  format: (value: number) => string;
  hint: string;
}

const ms = (v: number) => `${Math.round(v * 1000)}ms`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const num = (digits: number) => (v: number) => v.toFixed(digits);

export const PARAM_DEFS: ParamDef[] = [
  // --- Tone ---
  {
    index: ZZFX_PARAM.shape, label: 'WAVE', group: 'tone',
    min: 0, max: 5, step: 1,
    format: (v) => SHAPE_NAMES[Math.round(v)] ?? String(v),
    hint: 'Oscillator waveform',
  },
  {
    index: ZZFX_PARAM.shapeCurve, label: 'CURVE', group: 'tone',
    min: 0.1, max: 3, step: 0.05, format: num(2),
    hint: 'Waveform shaping — low values thin the pulse',
  },
  {
    index: ZZFX_PARAM.frequency, label: 'PITCH', group: 'tone',
    min: 20, max: 2000, step: 1,
    format: (v) => `${Math.round(v)}Hz`,
    hint: 'Base frequency (261.63Hz = C4 for melodic channels)',
  },
  {
    index: ZZFX_PARAM.volume, label: 'VOL', group: 'tone',
    min: 0, max: 1.5, step: 0.01, format: num(2),
    hint: 'Output level',
  },

  // --- Envelope ---
  {
    index: ZZFX_PARAM.attack, label: 'ATTACK', group: 'envelope',
    min: 0, max: 0.5, step: 0.001, format: ms,
    hint: 'Time to reach full volume',
  },
  {
    index: ZZFX_PARAM.sustain, label: 'SUSTAIN', group: 'envelope',
    min: 0, max: 1, step: 0.005, format: ms,
    hint: 'Time held at full volume',
  },
  {
    index: ZZFX_PARAM.decay, label: 'DECAY', group: 'envelope',
    min: 0, max: 0.5, step: 0.001, format: ms,
    hint: 'Fall from peak to the sustain level',
  },
  {
    index: ZZFX_PARAM.sustainVolume, label: 'S.LEVEL', group: 'envelope',
    min: 0, max: 1, step: 0.01, format: pct,
    hint: 'Level held after the decay',
  },
  {
    index: ZZFX_PARAM.release, label: 'RELEASE', group: 'envelope',
    min: 0, max: 1, step: 0.005, format: ms,
    hint: 'Fade to silence',
  },

  // --- Motion ---
  {
    index: ZZFX_PARAM.slide, label: 'SLIDE', group: 'motion',
    min: -20, max: 20, step: 0.5, format: num(1),
    hint: 'Constant pitch glide',
  },
  {
    index: ZZFX_PARAM.deltaSlide, label: 'D.SLIDE', group: 'motion',
    min: -20, max: 20, step: 0.5, format: num(1),
    hint: 'Accelerating pitch glide',
  },
  {
    index: ZZFX_PARAM.pitchJump, label: 'P.JUMP', group: 'motion',
    min: -60, max: 60, step: 1, format: num(0),
    hint: 'One-shot pitch leap',
  },
  {
    index: ZZFX_PARAM.pitchJumpTime, label: 'P.TIME', group: 'motion',
    min: 0, max: 0.3, step: 0.005, format: ms,
    hint: 'When the pitch leap happens',
  },
  {
    index: ZZFX_PARAM.repeatTime, label: 'LFO RATE', group: 'motion',
    min: 0, max: 0.5, step: 0.005, format: (v) => (v > 0 ? `${(1 / v).toFixed(1)}Hz` : 'OFF'),
    hint: 'Vibrato / tremolo repeat rate',
  },
  {
    index: ZZFX_PARAM.tremolo, label: 'TREMOLO', group: 'motion',
    min: 0, max: 1, step: 0.01, format: pct,
    hint: 'Volume wobble depth (needs LFO rate)',
  },

  // --- Texture ---
  {
    index: ZZFX_PARAM.noise, label: 'NOISE', group: 'texture',
    min: 0, max: 2.5, step: 0.05, format: num(2),
    hint: 'Noise blend — the core of drum sounds',
  },
  {
    index: ZZFX_PARAM.modulation, label: 'FM', group: 'texture',
    min: 0, max: 3, step: 0.05, format: num(2),
    hint: 'Frequency modulation',
  },
  {
    index: ZZFX_PARAM.bitCrush, label: 'CRUSH', group: 'texture',
    min: 0, max: 2, step: 0.05, format: num(2),
    hint: 'Lo-fi sample-rate reduction',
  },
  {
    index: ZZFX_PARAM.delay, label: 'DELAY', group: 'texture',
    min: 0, max: 0.3, step: 0.005, format: ms,
    hint: 'Short echo',
  },
  {
    index: ZZFX_PARAM.randomness, label: 'RANDOM', group: 'texture',
    min: 0, max: 0.5, step: 0.005, format: num(3),
    hint: 'Per-hit pitch variation',
  },
];

export const PARAM_GROUPS: { id: ParamGroup; label: string }[] = [
  { id: 'tone', label: 'TONE' },
  { id: 'envelope', label: 'ENVELOPE' },
  { id: 'motion', label: 'MOTION' },
  { id: 'texture', label: 'TEXTURE' },
];

export function paramsInGroup(group: ParamGroup): ParamDef[] {
  return PARAM_DEFS.filter((p) => p.group === group);
}

export interface EnvelopePoint {
  t: number; // seconds
  v: number; // 0..1
}

/**
 * The four-stage ZzFX amplitude envelope as points, for the ADSR display:
 * silence → attack peak → sustain hold → decay to sustain level → release.
 */
export function envelopePoints(params: ZzFXSound): { points: EnvelopePoint[]; duration: number } {
  const attack = Math.max(0, params[ZZFX_PARAM.attack] ?? 0);
  const sustain = Math.max(0, params[ZZFX_PARAM.sustain] ?? 0);
  const decay = Math.max(0, params[ZZFX_PARAM.decay] ?? 0);
  const release = Math.max(0, params[ZZFX_PARAM.release] ?? 0);
  const sustainVolume = Math.max(0, Math.min(1, params[ZZFX_PARAM.sustainVolume] ?? 1));

  const t1 = attack;
  const t2 = t1 + sustain;
  const t3 = t2 + decay;
  const t4 = t3 + release;

  return {
    points: [
      { t: 0, v: 0 },
      { t: t1, v: 1 },
      { t: t2, v: 1 },
      { t: t3, v: sustainVolume },
      { t: t4, v: 0 },
    ],
    duration: Math.max(t4, 0.001),
  };
}
