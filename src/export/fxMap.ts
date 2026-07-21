// The generator's effect codes -> the Tracker's native step FX.
//
// This is the single source of truth for the mapping: the exporter writes from
// it and the project cheat-sheet describes from it, so the two cannot drift.
//
// Ranges are taken from the FX table itself (`PatternFX` carries min/max/default
// per effect) rather than hand-written, so a value can never be written outside
// what the format declares. Note the library does not range-check on write, so
// clamping here is the only thing preventing a malformed project.
//
// Honest limit: the exact musical meaning of a value is documented for the FX
// this project already used. For the newer mappings the *range* is authoritative
// but the feel is a best guess, made without a device to verify against — they
// are deliberately mapped to conservative parts of their range.
import { PatternFX, type FX } from '../lib/polyend';
import type { EffectCode } from '../engine/types';

interface FxRecord {
  index: number;
  name: string;
  min: number;
  max: number;
  default: number;
  scaled?: { min: number; max: number };
}

function fxRecord(name: string): FxRecord {
  const record = (PatternFX as FxRecord[]).find((fx) => fx.name === name);
  if (!record) throw new Error(`Unknown Polyend FX: ${name}`);
  return record;
}

/** Clamp into the FX's declared range. */
function clampToFx(name: string, value: number): number {
  const { min, max } = fxRecord(name);
  return Math.round(Math.max(min, Math.min(max, value)));
}

/** Map a 0..255 generator value onto the FX's full declared range. */
function scaleToFx(name: string, value255: number): number {
  const { min, max } = fxRecord(name);
  const t = Math.max(0, Math.min(1, value255 / 255));
  return Math.round(min + t * (max - min));
}

export interface EffectMapping {
  /** Native FX name, or null when nothing on the device corresponds. */
  polyend: string | null;
  /** Convert the generator's 0..255 value into the FX's units. */
  toValue?: (value: number) => number;
  /** Does the in-app preview reproduce this, or is it device-only? */
  previewable: boolean;
  /** Plain-language description, used by the exported cheat-sheet. */
  what: string;
}

export const EFFECT_MAP: Record<EffectCode, EffectMapping> = {
  // --- Mapped and previewable ------------------------------------------
  SU: {
    polyend: 'Slide Up', previewable: true,
    toValue: (v) => scaleToFx('Slide Up', v),
    what: 'bends the pitch upward from the note — a rising sweep',
  },
  SD: {
    polyend: 'Slide Down', previewable: true,
    toValue: (v) => scaleToFx('Slide Down', v),
    what: 'bends the pitch downward — a falling sweep or drop',
  },
  ST: {
    polyend: 'Gate Length', previewable: true,
    // The generator shortens the envelope by up to 85%; invert that into a
    // gate percentage, floored so a note never becomes inaudible.
    toValue: (v) => clampToFx('Gate Length', Math.max(5, (1 - (v / 255) * 0.85) * 100)),
    what: 'cuts the note short, making it clipped and staccato',
  },
  BC: {
    polyend: 'Bit Depth', previewable: true,
    // 16 clean .. 4 destroyed; kept musical rather than using the full range.
    toValue: (v) => clampToFx('Bit Depth', Math.max(4, 16 - (v / 255) * 12)),
    what: 'crushes the sample to fewer bits — dirty and lo-fi',
  },
  VB: {
    polyend: 'Finetune LFO', previewable: true,
    toValue: (v) => clampToFx('Finetune LFO', ((v & 0xf) || 1) * 2),
    what: 'wobbles the pitch continuously — vibrato',
  },
  TR: {
    polyend: 'Volume LFO', previewable: true,
    toValue: (v) => clampToFx('Volume LFO', Math.max(1, (((v & 0xf) || 1) / 15) * 24)),
    what: 'pulses the volume — tremolo',
  },
  CN: {
    polyend: 'Chance', previewable: true,
    // Both sides are a 0..100 trigger probability, so this maps exactly.
    toValue: (v) => clampToFx('Chance', v),
    what: 'a percentage chance the note plays at all, re-rolled every loop',
  },
  GL: {
    polyend: 'Glide', previewable: true,
    toValue: (v) => scaleToFx('Glide', v),
    what: 'slides from the previous note into this one instead of retriggering',
  },

  // --- Mapped, device-only ---------------------------------------------
  // These have no equivalent in the ZzFX preview, so they are silent in the
  // app and audible only on the hardware. The cheat-sheet says so explicitly.
  RL: {
    polyend: 'Roll', previewable: false,
    toValue: (v) => Math.max(1, scaleToFx('Roll', v)),
    what: 'retriggers the note several times within the step — a drum roll or stutter',
  },
  AR: {
    polyend: 'Arp', previewable: false,
    toValue: (v) => scaleToFx('Arp', v),
    what: 'arpeggiates a chord from this step',
  },
  RN: {
    polyend: 'Random Note', previewable: false,
    toValue: (v) => clampToFx('Random Note', v),
    what: 'randomises the pitch each time the step plays, re-rolled every loop',
  },
  RI: {
    polyend: 'Random Instrument', previewable: false,
    toValue: (v) => clampToFx('Random Instrument', v),
    what: 'picks a different instrument at random each time the step plays',
  },
  RX: {
    polyend: 'Random FX Value', previewable: false,
    toValue: (v) => clampToFx('Random FX Value', v),
    what: "randomises the other FX slot's value each time the step plays",
  },
  LP: {
    polyend: 'Low-pass', previewable: false,
    toValue: (v) => scaleToFx('Low-pass', v),
    what: 'closes a low-pass filter on this step — darker',
  },
  HP: {
    polyend: 'High-pass', previewable: false,
    toValue: (v) => scaleToFx('High-pass', v),
    what: 'opens a high-pass filter on this step — thinner',
  },
  PN: {
    polyend: 'Panning', previewable: false,
    // Stored 0..100, displayed -50..50 on the device: 50 is centre.
    toValue: (v) => clampToFx('Panning', (v / 255) * 100),
    what: 'places this step in the stereo field',
  },
  DS: {
    polyend: 'Delay Send', previewable: false,
    toValue: (v) => scaleToFx('Delay Send', v),
    what: 'sends this step to the delay',
  },
  RS: {
    polyend: 'Reverb Send', previewable: false,
    toValue: (v) => scaleToFx('Reverb Send', v),
    what: 'sends this step to the reverb',
  },
  RP: {
    polyend: 'Reverse Playback', previewable: false,
    toValue: () => 1,
    what: 'plays the sample backwards from this step',
  },

  // --- Previewable, but no device equivalent ---------------------------
  // Deliberately dropped rather than faked; the cheat-sheet reports them.
  DT: { polyend: null, previewable: true, what: 'duty-cycle change (a pulse-width timbre shift)' },
  PD: { polyend: null, previewable: true, what: 'a fast downward pitch drop at the start of the note' },
};

/** Native FX for one generator effect, or null when it does not survive export. */
export function mapEffect(effect: { code: EffectCode; value: number }): FX | null {
  const mapping = EFFECT_MAP[effect.code];
  if (!mapping?.polyend) return null;
  const record = fxRecord(mapping.polyend);
  return {
    type: record as unknown as FX['type'],
    value: mapping.toValue ? mapping.toValue(effect.value) : clampToFx(mapping.polyend, effect.value),
  };
}

/** Codes that are written to the device but cannot be heard in the app. */
export const DEVICE_ONLY_CODES = (Object.keys(EFFECT_MAP) as EffectCode[]).filter(
  (code) => EFFECT_MAP[code].polyend && !EFFECT_MAP[code].previewable
);
