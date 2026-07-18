// Alternative per-channel pattern generators, selectable in the UI.
// Each returns ChannelData ([instrumentIndex, pan, ...32 notes]) matching the
// conventions of melody.ts / harmony.ts / bass.ts / drums.ts. 'AUTO' (null)
// keeps the vibe-driven default generator.
import {
  CH_ARP, CH_HAT, CH_KICK, CH_PAD, CH_SNARE, ChannelData, NoteName, ScaleName, VibeName,
  DEFAULT_PATTERN_LENGTH, DRUM_PERIOD, RHYTHM_PERIOD, rowsPerChord,
} from './types';
import { ChordProgression } from './chords';
import { getScaleNotes } from './scales';
import { euclidean } from './euclidean';
import { VIBE_CONFIG } from './vibes';
import { drumChannelFromHits, type DrumChannels } from './drums';

const ROWS = DRUM_PERIOD;      // drum templates tile at this period
const ROWS_PER_CHORD = RHYTHM_PERIOD; // melodic figures repeat at this period

export type LeadAlgo = 'walk' | 'arp' | 'riff';
export type HarmonyAlgo = 'gapfill' | 'stabs' | 'arp' | 'pedal';
export type BassAlgo = 'groove' | 'acid' | 'arp' | 'offbeat';
export type DrumAlgo = 'template' | 'euclid' | 'break' | 'four';
export type ArpAlgo = 'updown' | 'octaves' | 'random';
export type PadAlgo = 'sustain' | 'swell' | 'stab';

/** Per-channel algorithm override (one entry per channel): null = vibe default. */
export type ChannelAlgos = (string | null)[];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clampNote(n: number): number {
  return Math.max(1, Math.min(48, n));
}


/**
 * Walk the pattern in RHYTHM_PERIOD blocks, handing back the chord in force at
 * each block, so figures keep their 8-row period at any pattern length.
 */
function eachBlock(
  progression: ChordProgression,
  cb: (start: number, blockLength: number, chord: ChordProgression['chords'][number]) => void,
): void {
  const length = progression.chordAtRow.length;
  for (let start = 0; start < length; start += ROWS_PER_CHORD) {
    cb(start, Math.min(ROWS_PER_CHORD, length - start), progression.chordAtRow[start]);
  }
}

// --- LEAD ------------------------------------------------------------------

/** Chord arpeggios: cycles chord tones in a fixed direction per chord. */
export function generateArpLead(progression: ChordProgression, density: number): ChannelData {
  const notes: number[] = Array(progression.chordAtRow.length).fill(0);
  const direction = pick(['up', 'down', 'updown'] as const);
  const step = density > 0.55 ? 1 : 2; // 16ths when dense, 8ths otherwise

  eachBlock(progression, (start, blockLength, c) => {
    const up = [c.rootMelody, c.thirdMelody, c.fifthMelody, clampNote(c.rootMelody + 12)];
    const tones =
      direction === 'up' ? up :
      direction === 'down' ? [...up].reverse() :
      [...up, c.fifthMelody, c.thirdMelody]; // updown

    let t = 0;
    for (let i = 0; i < blockLength; i += step) {
      notes[start + i] = tones[t % tones.length];
      t++;
    }
  });

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

  // Repeat the motif, shifted to whichever chord sits under each block
  const notes: number[] = Array(progression.chordAtRow.length).fill(0);
  eachBlock(progression, (start, blockLength, chord) => {
    const delta = chord.rootMelody - base.rootMelody;
    for (let i = 0; i < blockLength; i++) {
      if (motif[i] > 0) notes[start + i] = clampNote(motif[i] + delta);
    }
  });

  return [0, 0, ...notes];
}

// --- HARMONY ----------------------------------------------------------------

/** Offbeat chord stabs (ska/house style). */
export function generateStabsHarmony(progression: ChordProgression): ChannelData {
  const notes: number[] = Array(progression.chordAtRow.length).fill(0);
  const positions = pick([[2, 6], [4], [2, 4, 6]]);

  eachBlock(progression, (start, blockLength, c) => {
    positions.forEach((pos, i) => {
      if (pos >= blockLength) return;
      notes[start + pos] = i % 2 === 0 ? c.thirdMelody : c.fifthMelody;
    });
  });

  return [1, 0, ...notes];
}

/** Continuous chord arpeggio (C64 style). */
export function generateArpHarmony(progression: ChordProgression): ChannelData {
  const notes: number[] = Array(progression.chordAtRow.length).fill(0);
  const cycle = pick([
    ['r', 't', 'f', 't'],
    ['r', 'f', 't', 'f'],
    ['r', 't', 'f', 'r'],
  ]);

  eachBlock(progression, (start, blockLength, c) => {
    for (let i = 0; i < blockLength; i += 2) {
      const tone = cycle[(i / 2) % cycle.length];
      notes[start + i] =
        tone === 'r' ? c.rootMelody : tone === 't' ? c.thirdMelody : c.fifthMelody;
    }
  });

  return [1, 0, ...notes];
}

/** Pedal tone: chord root held at each chord change. */
export function generatePedalHarmony(progression: ChordProgression): ChannelData {
  // A pedal follows chord changes rather than the 8-row figure period.
  const length = progression.chordAtRow.length;
  const perChord = rowsPerChord(length);
  const notes: number[] = Array(length).fill(0);
  for (let seg = 0; seg < progression.chords.length; seg++) {
    const start = seg * perChord;
    if (start >= length) break;
    const c = progression.chords[seg];
    notes[start] = c.rootMelody;
    const mid = start + Math.floor(perChord / 2);
    if (mid < length && Math.random() < 0.5) notes[mid] = c.rootMelody;
  }
  return [1, 0, ...notes];
}

// --- BASS -------------------------------------------------------------------

/** 16th-note acid line: mostly root with octave jumps and chord-tone spice. */
export function generateAcidBass(progression: ChordProgression): ChannelData {
  const notes: number[] = Array(progression.chordAtRow.length).fill(0);

  eachBlock(progression, (start, blockLength, c) => {
    for (let i = 0; i < blockLength; i++) {
      const strong = i % 2 === 0;
      if (Math.random() >= (strong ? 0.85 : 0.45)) continue;
      const r = Math.random();
      notes[start + i] =
        r < 0.6 ? c.root :
        r < 0.8 ? clampNote(c.root + 12) :
        r < 0.92 ? c.fifth : c.third;
    }
    notes[start] = c.root; // anchor every block on the root
  });

  return [2, 0, ...notes];
}

/** Offbeat eighth bass (house pump): root between the kicks. */
export function generateOffbeatBass(progression: ChordProgression): ChannelData {
  const notes: number[] = Array(progression.chordAtRow.length).fill(0);
  eachBlock(progression, (start, blockLength, chord) => {
    if (blockLength > 4) notes[start + 4] = chord.root;
    if (blockLength > 6 && Math.random() < 0.3) notes[start + 6] = chord.fifth;
  });
  return [2, 0, ...notes];
}

/** Root-fifth-octave bass arpeggio. */
export function generateArpBass(progression: ChordProgression): ChannelData {
  const notes: number[] = Array(progression.chordAtRow.length).fill(0);
  eachBlock(progression, (start, blockLength, c) => {
    const cycle = [c.root, c.fifth, clampNote(c.root + 12), c.fifth];
    for (let i = 0; i < blockLength; i += 2) {
      notes[start + i] = cycle[(i / 2) % cycle.length];
    }
  });
  return [2, 0, ...notes];
}

// --- DRUMS ------------------------------------------------------------------

function assembleDrums(
  kicks: Set<number>,
  snares: Set<number>,
  hats: Set<number>,
  length: number,
): DrumChannels {
  const kickArray: number[] = Array(length).fill(0);
  for (let row = 0; row < length; row++) {
    if (kicks.has(row % DRUM_PERIOD)) kickArray[row] = 1;
  }
  return {
    channels: [
      drumChannelFromHits(kicks, CH_KICK, length),
      drumChannelFromHits(snares, CH_SNARE, length),
      drumChannelFromHits(hats, CH_HAT, length),
    ],
    kickPattern: kickArray,
  };
}

const EUCLID_KICK_PULSES: Record<string, number> = {
  sparse: 3, light: 4, medium: 5, high: 7, intense: 9,
};

/** Fully euclidean kit: kick/snare/hat as rotated euclidean rhythms. */
export function generateEuclidDrums(vibe: VibeName, length: number = DEFAULT_PATTERN_LENGTH): DrumChannels {
  const intensity = VIBE_CONFIG[vibe].drumIntensity;
  const kickPulses = EUCLID_KICK_PULSES[intensity] ?? 5;

  const kickPattern = euclidean(kickPulses, ROWS, 0);
  const kicks = new Set<number>();
  for (let i = 0; i < ROWS; i++) if (kickPattern[i]) kicks.add(i);

  const snarePattern = euclidean(2 + Math.floor(Math.random() * 3), ROWS, 4 + Math.floor(Math.random() * 8));
  const snares = new Set<number>();
  for (let i = 0; i < ROWS; i++) if (snarePattern[i]) snares.add(i);

  const hatPattern = euclidean(9 + Math.floor(Math.random() * 5), ROWS, Math.floor(Math.random() * 4));
  const hats = new Set<number>();
  for (let i = 0; i < ROWS; i++) if (hatPattern[i]) hats.add(i);

  return assembleDrums(kicks, snares, hats, length);
}

// Classic break skeletons (amen-ish, funky-drummer-ish)
const BREAK_TEMPLATES: { kick: number[]; snare: number[]; hat: number[] }[] = [
  { kick: [0, 10, 16, 22], snare: [8, 14, 24, 30], hat: [4, 20, 28] },
  { kick: [0, 6, 16, 26], snare: [8, 24, 30], hat: [2, 12, 20] },
  { kick: [0, 4, 14, 16, 24], snare: [8, 12, 22, 28], hat: [2, 6, 10, 18, 26, 30] },
];

/** Breakbeat: a classic break skeleton with light ghost variation. */
export function generateBreakDrums(length: number = DEFAULT_PATTERN_LENGTH): DrumChannels {
  const t = pick(BREAK_TEMPLATES);
  const kicks = new Set(t.kick);
  const snares = new Set(t.snare);
  const hats = new Set(t.hat);
  // Ghost hits keep loops from feeling static
  if (Math.random() < 0.4) snares.add(pick([14, 30, 18]));
  if (Math.random() < 0.3) kicks.add(pick([20, 26]));
  return assembleDrums(kicks, snares, hats, length);
}

/** Strict four-on-the-floor: kicks on the beat, claps on the backbeat. */
export function generateFourDrums(length: number = DEFAULT_PATTERN_LENGTH): DrumChannels {
  const kicks = new Set([0, 8, 16, 24]);
  // With its own channel the clap can sit on the backbeat under the kick.
  const snares = new Set([8, 24]);
  const hats = new Set([4, 12, 20, 28]); // offbeat pump
  for (const h of [2, 6, 10, 14, 18, 22, 26, 30]) {
    if (Math.random() < 0.35) hats.add(h);
  }
  return assembleDrums(kicks, snares, hats, length);
}

// --- ARP --------------------------------------------------------------------
// A dedicated arpeggio channel, one octave above the harmony.

export function generateArpChannel(
  progression: ChordProgression,
  algo: string | null,
  role: string,
): ChannelData {
  const notes: number[] = Array(progression.chordAtRow.length).fill(0);
  if (role === 'breakdown') return [CH_ARP, 0, ...notes];

  const mode = algo ?? pick(['updown', 'octaves', 'random']);
  const step = role === 'climax' || role === 'chorus' ? 1 : 2;

  eachBlock(progression, (start, blockLength, c) => {
    const base = [c.rootMelody, c.thirdMelody, c.fifthMelody];
    const tones =
      mode === 'octaves'
        ? [c.rootMelody, clampNote(c.rootMelody + 12), c.fifthMelody, clampNote(c.thirdMelody + 12)]
        : mode === 'random'
          ? base
          : [...base, clampNote(c.rootMelody + 12), c.fifthMelody, c.thirdMelody]; // updown

    let t = 0;
    for (let i = 0; i < blockLength; i += step) {
      notes[start + i] = mode === 'random' ? pick(tones) : tones[t % tones.length];
      t++;
    }
  });

  return [CH_ARP, 0, ...notes];
}

// --- PAD --------------------------------------------------------------------
// Long sustained chord tones underneath everything. Sparse by design: one or
// two notes per chord, letting the instrument's release do the work.

export function generatePadChannel(
  progression: ChordProgression,
  algo: string | null,
  role: string,
): ChannelData {
  // Pads move with chord changes, not the 8-row figure period.
  const length = progression.chordAtRow.length;
  const perChord = rowsPerChord(length);
  const notes: number[] = Array(length).fill(0);
  const mode = algo ?? 'sustain';

  for (let seg = 0; seg < progression.chords.length; seg++) {
    const start = seg * perChord;
    if (start >= length) break;
    const c = progression.chords[seg];
    const mid = start + Math.floor(perChord / 2);

    if (mode === 'stab') {
      notes[start] = c.thirdMelody;
    } else if (mode === 'swell') {
      // Enter late in the segment so the pad rises into the next chord
      if (mid < length) notes[mid] = c.rootMelody;
    } else {
      notes[start] = c.rootMelody;
      if ((role === 'climax' || role === 'chorus') && mid < length) notes[mid] = c.fifthMelody;
    }
  }

  return [CH_PAD, 0, ...notes];
}
