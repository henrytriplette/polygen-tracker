// Render the three drum channels into a single sliced instrument.
//
// The Tracker's original hardware gives you eight audio tracks and a finite
// sample bank, and a drum kit built as three separate instruments spends three
// slots on what the device is designed to hold in one. A `.pti` carries 48
// slice points and a Slice play mode; the `Slice` step FX selects which slice
// fires. Kick, snare and hat concatenated into one instrument is both how kits
// are actually built on this device and two instrument slots cheaper.
//
// Slice points are written in the same normalized 0..65535 position space the
// format uses for `startPoint` / `endPoint` / the loop points (whose defaults
// are 65535 and 65534 — i.e. the end of the sample regardless of its length).
// That reading is inferred from those defaults rather than from documentation,
// and has not been checked against hardware.
import { ZZFX } from '../engine/zzfx';
import { CH_HAT, CH_KICK, CH_SNARE, DRUM_HIT_NOTE } from '../engine/types';
import type { Song } from '../engine/types';
import { AudioUtil } from '../lib/polyend';
import { EXPORT_PEAK } from './instrumentSettings';


/** Channels folded into the kit, in slice order. */
export const KIT_CHANNELS = [CH_KICK, CH_SNARE, CH_HAT];

/** Position space used by the format's start/end/loop/slice fields. */
const POSITION_MAX = 65535;

/**
 * Silence between slices, so one drum's tail cannot bleed into the next
 * slice's attack when the device plays to the following slice point.
 */
const GAP_SECONDS = 0.01;

export interface DrumKit {
  wav: ArrayBuffer;
  /** Normalized start position of each slice, in KIT_CHANNELS order. */
  slicePoints: number[];
  sliceCount: number;
  /** Loudest sample before normalization, for the caller's gain staging. */
  peak: number;
}

/** Render one drum channel's instrument at its trigger pitch, normalized. */
function renderDrum(params: number[]): Float32Array {
  const p = [...params];
  p[2] = (p[2] ?? 0) * 2 ** ((DRUM_HIT_NOTE - 12) / 12);
  const samples = ZZFX.buildSamples(...p);

  let peak = 0;
  for (const sample of samples) {
    const abs = sample < 0 ? -sample : sample;
    if (abs > peak) peak = abs;
  }

  // Each drum is normalized individually so the three sit at a comparable
  // level inside the shared sample — the kit has one volume control, so
  // balance has to be baked in here.
  const gain = peak > 1e-4 ? EXPORT_PEAK / peak : 1;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain;
  return out;
}

/**
 * Concatenate the drum channels into one sliced instrument.
 * Returns null when the song has no drum instruments to render.
 */
export function buildDrumKit(song: Song): DrumKit | null {
  const rendered = KIT_CHANNELS.map((ch) => {
    const params = song.instruments[ch];
    return params ? renderDrum(params) : null;
  });
  if (rendered.every((r) => r === null)) return null;

  const gapSamples = Math.round(GAP_SECONDS * ZZFX.sampleRate);
  const total = rendered.reduce((sum, r) => sum + (r?.length ?? 0) + gapSamples, 0);

  const buffer = new Float32Array(total);
  const slicePoints: number[] = [];
  let cursor = 0;
  let peak = 0;

  for (const drum of rendered) {
    // Record the slice start before writing, so a missing drum still occupies
    // a slice index and the channel -> slice mapping stays positional.
    slicePoints.push(Math.round((cursor / total) * POSITION_MAX));
    if (drum) {
      buffer.set(drum, cursor);
      for (const sample of drum) {
        const abs = sample < 0 ? -sample : sample;
        if (abs > peak) peak = abs;
      }
      cursor += drum.length;
    }
    cursor += gapSamples;
  }

  return {
    wav: AudioUtil.createWavFile(buffer, {
      numChannels: 1,
      sampleRate: ZZFX.sampleRate,
      bitsPerSample: 16,
    }),
    slicePoints,
    sliceCount: KIT_CHANNELS.length,
    peak,
  };
}

/** Slice index (0-based) a drum channel triggers, or null if it isn't a drum. */
export function sliceForChannel(ch: number): number | null {
  const index = KIT_CHANNELS.indexOf(ch);
  return index === -1 ? null : index;
}
