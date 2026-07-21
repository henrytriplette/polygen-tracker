// Per-channel .pti instrument settings.
//
// The .pti format carries a full mixer channel — volume, panning, filter,
// delay/reverb sends — that the exporter used to leave at defaults, so every
// project arrived flat, centred and dry. This module computes those settings
// from what the song already knows: which channel this is, what its rendered
// sample peaks at, and (lightly) the song's vibe.
//
// Value ranges below were verified by writing an instrument through
// tracker-lib's Instrument.write and reading it back with Instrument.parse:
//   volume    0..2   (1 = unity)
//   panning  -1..1   (0 = centre)
//   cutoff, resonance, delaySend, reverbSend, overdrive: 0..1
//   tune      signed semitones, finetune signed cents
//
// Honest limit: the in-app ZzFX preview does not model the device's filter or
// send effects, so these settings are audible only on the hardware (or in the
// official Polyend tools). They are kept conservative for exactly that reason.
import { CH_ARP, CH_BASS, CH_HARMONY, CH_HAT, CH_KICK, CH_LEAD, CH_PAD, CH_SNARE } from '../engine/types';
import type { Song, VibeName } from '../engine/types';
import { InstrumentFilterType, InstrumentPlayMode } from '../lib/polyend';

/**
 * Peak every rendered sample is normalized to, just under full scale.
 * Gain staging happens in the audio because the device's volume field
 * (0..2) cannot express the boost quiet ZzFX renders would need.
 */
export const EXPORT_PEAK = 0.89;

export interface ChannelInstrumentSettings {
  volume: number;
  panning: number;
  delaySend: number;
  reverbSend: number;
  filterEnabled: boolean;
  filterType: number;
  cutoff: number;
  resonance: number;
  playmode: number;
}

/**
 * Samples are normalized to a common peak when they are rendered, so the
 * volume field carries the mix balance alone. A channel that renders silent
 * is the one exception: it keeps unity so it is not silently boosted.
 */

/**
 * Static mix decisions per channel: relative level, stage position, and how
 * much space each part gets. Levels follow the usual chip-mix shape — kick and
 * bass carry, hats and pads sit back. Panning is deliberately narrow: the
 * Tracker is often played on small speakers, and ±0.25 is already audible.
 */
const CHANNEL_MIX: Record<number, { trim: number; pan: number; delay: number; reverb: number }> = {
  [CH_LEAD]:    { trim: 0.9,  pan: 0,     delay: 0.12, reverb: 0.1 },
  [CH_HARMONY]: { trim: 0.8,  pan: -0.2,  delay: 0.08, reverb: 0.15 },
  [CH_BASS]:    { trim: 0.95, pan: 0,     delay: 0,    reverb: 0 },
  [CH_KICK]:    { trim: 1.0,  pan: 0,     delay: 0,    reverb: 0 },
  [CH_SNARE]:   { trim: 0.9,  pan: 0.08,  delay: 0,    reverb: 0.12 },
  [CH_HAT]:     { trim: 0.7,  pan: 0.22,  delay: 0,    reverb: 0.08 },
  [CH_ARP]:     { trim: 0.75, pan: -0.25, delay: 0.15, reverb: 0.1 },
  [CH_PAD]:     { trim: 0.7,  pan: 0.2,   delay: 0.05, reverb: 0.3 },
};

/**
 * Gentle spectral carving. Hats and snares lose the low end that would sit on
 * the kick; the pad loses a little top so it stops masking the lead. Cutoffs
 * are mild on purpose — the goal is a cleaner default, not a new sound.
 */
const CHANNEL_FILTER: Record<number, { type: number; cutoff: number; resonance: number }> = {
  [CH_HAT]:   { type: InstrumentFilterType.HighPass, cutoff: 0.25, resonance: 0.05 },
  [CH_SNARE]: { type: InstrumentFilterType.HighPass, cutoff: 0.12, resonance: 0.05 },
  [CH_PAD]:   { type: InstrumentFilterType.LowPass,  cutoff: 0.85, resonance: 0.05 },
};

/** Vibes whose identity is the send section, not just the notes. */
const VIBE_SEND_OVERRIDES: Partial<Record<VibeName, Partial<Record<number, { delay?: number; reverb?: number }>>>> = {
  dub: {
    [CH_SNARE]:   { delay: 0.45, reverb: 0.2 },
    [CH_LEAD]:    { delay: 0.35 },
    [CH_HARMONY]: { delay: 0.3 },
  },
  lofi: {
    [CH_LEAD]:    { reverb: 0.2 },
    [CH_HARMONY]: { reverb: 0.25 },
  },
  dungeon: {
    [CH_LEAD]: { reverb: 0.3 },
    [CH_PAD]:  { reverb: 0.45 },
  },
};

/**
 * Settings for one channel's exported instrument.
 *
 * @param peak Loudest absolute sample value of the rendered WAV; the volume
 *             gain-stages that peak toward TARGET_PEAK, then applies the mix
 *             trim. A silent render keeps unity volume rather than amplifying
 *             noise toward the target.
 */
export function channelInstrumentSettings(song: Song, ch: number, peak: number): ChannelInstrumentSettings {
  const mix = CHANNEL_MIX[ch] ?? { trim: 0.85, pan: 0, delay: 0, reverb: 0.1 };
  const filter = CHANNEL_FILTER[ch];
  const override = VIBE_SEND_OVERRIDES[song.config.vibe]?.[ch];

  return {
    volume: peak > 0.001 ? Math.min(2, Math.max(0, mix.trim)) : 1,
    panning: mix.pan,
    delaySend: Math.min(1, override?.delay ?? mix.delay),
    reverbSend: Math.min(1, override?.reverb ?? mix.reverb),
    filterEnabled: !!filter,
    filterType: filter?.type ?? InstrumentFilterType.LowPass,
    cutoff: filter?.cutoff ?? 1,
    resonance: filter?.resonance ?? 0,
    playmode: InstrumentPlayMode.OneShot,
  };
}
