// Alternative per-channel pattern generators, selectable in the UI.
// Each returns ChannelData ([instrumentIndex, pan, ...32 notes]) matching the
// conventions of melody.ts / harmony.ts / bass.ts / drums.ts. 'AUTO' (null)
// keeps the vibe-driven default generator.
import { ChannelData, DRUM_NOTES, NoteName, ScaleName, VibeName } from './types';
import { ChordProgression } from './chords';
import { getScaleNotes } from './scales';
import { euclidean } from './euclidean';
import { VIBE_CONFIG } from './vibes';

const ROWS = 32;
const ROWS_PER_CHORD = 8;

export type LeadAlgo = 'walk' | 'arp' | 'riff';
export type HarmonyAlgo = 'gapfill' | 'stabs' | 'arp' | 'pedal';
export type BassAlgo = 'groove' | 'acid' | 'arp' | 'offbeat';
export type DrumAlgo = 'template' | 'euclid' | 'break' | 'four';

/** Per-channel algorithm override: null = vibe-driven default. */
export type ChannelAlgos = [LeadAlgo | null, HarmonyAlgo | null, BassAlgo | null, DrumAlgo | null];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clampNote(n: number): number {
  return Math.max(1, Math.min(48, n));
}

// --- LEAD ------------------------------------------------------------------

/** Chord arpeggios: cycles chord tones in a fixed direction per chord. */
export function generateArpLead(progression: ChordProgression, density: number): ChannelData {
  const notes: number[] = Array(ROWS).fill(0);
  const direction = pick(['up', 'down', 'updown'] as const);
  const step = density > 0.55 ? 1 : 2; // 16ths when dense, 8ths otherwise

  for (let chordIdx = 0; chordIdx < 4; chordIdx++) {
    const c = progression.chords[chordIdx];
    const up = [c.rootMelody, c.thirdMelody, c.fifthMelody, clampNote(c.rootMelody + 12)];
    const tones =
      direction === 'up' ? up :
      direction === 'down' ? [...up].reverse() :
      [...up, c.fifthMelody, c.thirdMelody]; // updown

    let t = 0;
    for (let i = 0; i < ROWS_PER_CHORD; i += step) {
      notes[chordIdx * ROWS_PER_CHORD + i] = tones[t % tones.length];
      t++;
    }
  }

  return [0, 0, ...notes];
}

/** Short ostinato riff, transposed to follow each chord. */
export function generateRiffLead(
  key: NoteName,
  scale: ScaleName,
  progression: ChordProgression,
): ChannelData {
  const scaleNotes = getScaleNotes(key, scale, 4, 5).map((n) => n.note);
  const base = progression.chords[0];
  const pool = [base.rootMelody, base.thirdMelody, base.fifthMelody, ...scaleNotes.filter(
    (n) => n >= base.rootMelody - 2 && n <= base.fifthMelody + 4
  )];

  // Build one 8-row motif: 3-5 hits, always starting on the chord root
  const rhythm = pick([
    [1, 0, 1, 1, 0, 0, 1, 0],
    [1, 0, 0, 1, 0, 1, 0, 0],
    [1, 1, 0, 1, 0, 0, 1, 1],
    [1, 0, 1, 0, 1, 1, 0, 0],
  ]);
  const motif: number[] = Array(ROWS_PER_CHORD).fill(0);
  let first = true;
  for (let i = 0; i < ROWS_PER_CHORD; i++) {
    if (!rhythm[i]) continue;
    motif[i] = first ? base.rootMelody : pick(pool);
    first = false;
  }

  // Repeat the motif, shifted to each chord's root
  const notes: number[] = Array(ROWS).fill(0);
  for (let chordIdx = 0; chordIdx < 4; chordIdx++) {
    const delta = progression.chords[chordIdx].rootMelody - base.rootMelody;
    for (let i = 0; i < ROWS_PER_CHORD; i++) {
      if (motif[i] > 0) notes[chordIdx * ROWS_PER_CHORD + i] = clampNote(motif[i] + delta);
    }
  }

  return [0, 0, ...notes];
}

// --- HARMONY ----------------------------------------------------------------

/** Offbeat chord stabs (ska/house style). */
export function generateStabsHarmony(progression: ChordProgression): ChannelData {
  const notes: number[] = Array(ROWS).fill(0);
  const positions = pick([[2, 6], [4], [2, 4, 6]]);

  for (let chordIdx = 0; chordIdx < 4; chordIdx++) {
    const c = progression.chords[chordIdx];
    positions.forEach((posInSegment, i) => {
      const tone = i % 2 === 0 ? c.thirdMelody : c.fifthMelody;
      notes[chordIdx * ROWS_PER_CHORD + posInSegment] = tone;
    });
  }

  return [1, 0, ...notes];
}

/** Continuous chord arpeggio (C64 style). */
export function generateArpHarmony(progression: ChordProgression): ChannelData {
  const notes: number[] = Array(ROWS).fill(0);
  const cycle = pick([
    ['r', 't', 'f', 't'],
    ['r', 'f', 't', 'f'],
    ['r', 't', 'f', 'r'],
  ]);

  for (let chordIdx = 0; chordIdx < 4; chordIdx++) {
    const c = progression.chords[chordIdx];
    for (let i = 0; i < ROWS_PER_CHORD; i += 2) {
      const tone = cycle[(i / 2) % cycle.length];
      notes[chordIdx * ROWS_PER_CHORD + i] =
        tone === 'r' ? c.rootMelody : tone === 't' ? c.thirdMelody : c.fifthMelody;
    }
  }

  return [1, 0, ...notes];
}

/** Pedal tone: chord root held at each chord change. */
export function generatePedalHarmony(progression: ChordProgression): ChannelData {
  const notes: number[] = Array(ROWS).fill(0);
  for (let chordIdx = 0; chordIdx < 4; chordIdx++) {
    const c = progression.chords[chordIdx];
    notes[chordIdx * ROWS_PER_CHORD] = c.rootMelody;
    if (Math.random() < 0.5) notes[chordIdx * ROWS_PER_CHORD + 4] = c.rootMelody;
  }
  return [1, 0, ...notes];
}

// --- BASS -------------------------------------------------------------------

/** 16th-note acid line: mostly root with octave jumps and chord-tone spice. */
export function generateAcidBass(progression: ChordProgression): ChannelData {
  const notes: number[] = Array(ROWS).fill(0);

  for (let chordIdx = 0; chordIdx < 4; chordIdx++) {
    const c = progression.chords[chordIdx];
    for (let i = 0; i < ROWS_PER_CHORD; i++) {
      const strong = i % 2 === 0;
      if (Math.random() >= (strong ? 0.85 : 0.45)) continue;
      const r = Math.random();
      const note =
        r < 0.6 ? c.root :
        r < 0.8 ? clampNote(c.root + 12) :
        r < 0.92 ? c.fifth : c.third;
      notes[chordIdx * ROWS_PER_CHORD + i] = note;
    }
    // Always anchor the chord change on the root
    notes[chordIdx * ROWS_PER_CHORD] = c.root;
  }

  return [2, 0, ...notes];
}

/** Offbeat eighth bass (house pump): root between the kicks. */
export function generateOffbeatBass(progression: ChordProgression): ChannelData {
  const notes: number[] = Array(ROWS).fill(0);
  for (let beat = 0; beat < 4; beat++) {
    const chord = progression.chordAtRow[beat * 8];
    notes[beat * 8 + 4] = chord.root;
    if (Math.random() < 0.3) notes[beat * 8 + 6] = chord.fifth;
  }
  return [2, 0, ...notes];
}

/** Root-fifth-octave bass arpeggio. */
export function generateArpBass(progression: ChordProgression): ChannelData {
  const notes: number[] = Array(ROWS).fill(0);
  for (let chordIdx = 0; chordIdx < 4; chordIdx++) {
    const c = progression.chords[chordIdx];
    const cycle = [c.root, c.fifth, clampNote(c.root + 12), c.fifth];
    for (let i = 0; i < ROWS_PER_CHORD; i += 2) {
      notes[chordIdx * ROWS_PER_CHORD + i] = cycle[(i / 2) % cycle.length];
    }
  }
  return [2, 0, ...notes];
}

// --- DRUMS ------------------------------------------------------------------

interface DrumResult {
  channelData: ChannelData;
  kickPattern: number[];
}

function assembleDrums(kicks: Set<number>, snares: Set<number>, hats: Set<number>): DrumResult {
  const notes: number[] = Array(ROWS).fill(0);
  const kickArray: number[] = Array(ROWS).fill(0);
  for (let i = 0; i < ROWS; i++) {
    if (kicks.has(i)) {
      notes[i] = DRUM_NOTES.KICK;
      kickArray[i] = 1;
    } else if (snares.has(i)) {
      notes[i] = DRUM_NOTES.SNARE;
    } else if (hats.has(i)) {
      notes[i] = DRUM_NOTES.HAT;
    }
  }
  return { channelData: [3, 0, ...notes], kickPattern: kickArray };
}

const EUCLID_KICK_PULSES: Record<string, number> = {
  sparse: 3, light: 4, medium: 5, high: 7, intense: 9,
};

/** Fully euclidean kit: kick/snare/hat as rotated euclidean rhythms. */
export function generateEuclidDrums(vibe: VibeName): DrumResult {
  const intensity = VIBE_CONFIG[vibe].drumIntensity;
  const kickPulses = EUCLID_KICK_PULSES[intensity] ?? 5;

  const kickPattern = euclidean(kickPulses, ROWS, 0);
  const kicks = new Set<number>();
  for (let i = 0; i < ROWS; i++) if (kickPattern[i]) kicks.add(i);

  const snarePattern = euclidean(2 + Math.floor(Math.random() * 3), ROWS, 4 + Math.floor(Math.random() * 8));
  const snares = new Set<number>();
  for (let i = 0; i < ROWS; i++) if (snarePattern[i] && !kicks.has(i)) snares.add(i);

  const hatPattern = euclidean(9 + Math.floor(Math.random() * 5), ROWS, Math.floor(Math.random() * 4));
  const hats = new Set<number>();
  for (let i = 0; i < ROWS; i++) if (hatPattern[i] && !kicks.has(i) && !snares.has(i)) hats.add(i);

  return assembleDrums(kicks, snares, hats);
}

// Classic break skeletons (amen-ish, funky-drummer-ish)
const BREAK_TEMPLATES: { kick: number[]; snare: number[]; hat: number[] }[] = [
  { kick: [0, 10, 16, 22], snare: [8, 14, 24, 30], hat: [4, 20, 28] },
  { kick: [0, 6, 16, 26], snare: [8, 24, 30], hat: [2, 12, 20] },
  { kick: [0, 4, 14, 16, 24], snare: [8, 12, 22, 28], hat: [2, 6, 10, 18, 26, 30] },
];

/** Breakbeat: a classic break skeleton with light ghost variation. */
export function generateBreakDrums(): DrumResult {
  const t = pick(BREAK_TEMPLATES);
  const kicks = new Set(t.kick);
  const snares = new Set(t.snare);
  const hats = new Set(t.hat);
  // Ghost hits keep loops from feeling static
  if (Math.random() < 0.4) snares.add(pick([14, 30, 18]));
  if (Math.random() < 0.3) kicks.add(pick([20, 26]));
  return assembleDrums(kicks, snares, hats);
}

/** Strict four-on-the-floor with skipped claps and offbeat hats. */
export function generateFourDrums(): DrumResult {
  const kicks = new Set([0, 8, 16, 24]);
  // The kick owns the beat rows on this single drum channel, so claps go on
  // the skipped offbeat (rows 12/28) — a classic house move.
  const snares = new Set([12, 28]);
  const hats = new Set([4, 20]);
  for (const h of [2, 6, 10, 14, 18, 22, 26, 30]) {
    if (Math.random() < 0.5) hats.add(h);
  }
  return assembleDrums(kicks, snares, hats);
}
