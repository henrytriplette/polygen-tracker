// Alternative per-channel pattern generators, selectable in the UI.
// Each returns ChannelData ([instrumentIndex, pan, ...32 notes]) matching the
// conventions of melody.ts / harmony.ts / bass.ts / drums.ts. 'AUTO' (null)
// keeps the vibe-driven default generator.
import {
  CH_ARP, CH_HAT, CH_KICK, CH_LEAD, CH_PAD, CH_SNARE, ChannelData, NoteName, ScaleName, VibeName,
  DEFAULT_PATTERN_LENGTH, DRUM_PERIOD, RHYTHM_PERIOD, rowsPerChord,
} from './types';
import { ChordProgression } from './chords';
import { getScaleNotes } from './scales';
import { euclidean } from './euclidean';
import { VIBE_CONFIG } from './vibes';
import { drumChannelFromHits, type DrumChannels } from './drums';

const ROWS = DRUM_PERIOD;      // drum templates tile at this period
const ROWS_PER_CHORD = RHYTHM_PERIOD; // melodic figures repeat at this period

export type LeadAlgo = 'walk' | 'arp' | 'riff' | 'markov' | 'markovLearn' | 'lsystem' | 'motif';
export type HarmonyAlgo = 'gapfill' | 'stabs' | 'arp' | 'pedal';
export type BassAlgo = 'groove' | 'acid' | 'arp' | 'offbeat' | 'poly';
export type DrumAlgo = 'template' | 'euclid' | 'break' | 'four' | 'automata';
export type ArpAlgo = 'updown' | 'octaves' | 'random' | 'poly';
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

// --- shared helper ----------------------------------------------------------

/** Nearest index in the scale array to a given note. */
function nearestScaleIndex(scaleNotes: number[], note: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < scaleNotes.length; i++) {
    const dist = Math.abs(scaleNotes[i] - note);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

// --- L-SYSTEM LEAD ----------------------------------------------------------
// A short axiom is rewritten by production rules until it fills the pattern.
// Because every expansion contains scaled copies of what came before, the line
// is self-similar: motifs recur at several time scales instead of an 8-row
// figure simply tiling. That is what long patterns need.

interface LSystem {
  axiom: string;
  rules: Record<string, string>;
  /** Scale-degree movement for each symbol. */
  offsets: Record<string, number>;
}

const L_SYSTEMS: LSystem[] = [
  // Expanding arch — the classic a -> aba growth
  { axiom: 'ab', rules: { a: 'aba', b: 'cb' }, offsets: { a: 1, b: 2, c: -2 } },
  // Descending cascade
  { axiom: 'abc', rules: { a: 'ab', b: 'cb', c: 'ca' }, offsets: { a: -1, b: -2, c: 3 } },
  // Tight oscillation that occasionally breaks upward
  { axiom: 'ab', rules: { a: 'ab', b: 'ba', c: 'ac' }, offsets: { a: 1, b: -1, c: 4 } },
  // Wide, IDM-leaning
  { axiom: 'ac', rules: { a: 'acb', b: 'a', c: 'cba' }, offsets: { a: 2, b: -3, c: 5 } },
];

function expandLSystem(system: LSystem, minLength: number): string {
  let current = system.axiom;
  // Cap the iterations so a runaway rule set cannot allocate forever
  for (let i = 0; i < 8 && current.length < minLength; i++) {
    let next = '';
    for (const symbol of current) next += system.rules[symbol] ?? symbol;
    if (next === current) break; // non-productive rules
    current = next;
  }
  return current;
}

export function generateLSystemLead(
  key: NoteName,
  scale: ScaleName,
  density: number,
  progression: ChordProgression,
): ChannelData {
  const length = progression.chordAtRow.length;
  const scaleNotes = getScaleNotes(key, scale, 4, 5).map((n) => n.note);
  if (scaleNotes.length === 0) return [CH_LEAD, 0, ...Array(length).fill(0)];

  const step = density > 0.55 ? 1 : 2; // 16ths when dense, 8ths otherwise
  const onsets = Math.ceil(length / step);
  const system = pick(L_SYSTEMS);
  const word = expandLSystem(system, onsets);

  const notes: number[] = Array(length).fill(0);
  let index = nearestScaleIndex(scaleNotes, progression.chordAtRow[0].rootMelody);

  for (let i = 0, row = 0; row < length; i++, row += step) {
    const symbol = word[i % word.length];
    index += system.offsets[symbol] ?? 0;
    // Reflect at the edges so the line turns around instead of sticking
    if (index < 0) index = Math.min(scaleNotes.length - 1, -index);
    if (index >= scaleNotes.length) index = Math.max(0, 2 * (scaleNotes.length - 1) - index);
    notes[row] = scaleNotes[index];
  }

  return [CH_LEAD, 0, ...notes];
}

// --- MOTIF DEVELOPMENT ------------------------------------------------------
// State a short motif, then restate it transformed — transposed, inverted,
// retrograde, augmented. Theme-and-variation rather than fresh invention, which
// is what makes a melody sound composed instead of merely walked.

type MotifTransform = 'original' | 'transpose' | 'invert' | 'retrograde' | 'augment';

function transformMotif(
  motif: number[],
  transform: MotifTransform,
  scaleNotes: number[],
  targetRoot: number,
  sourceRoot: number,
): number[] {
  const out: number[] = Array(motif.length).fill(0);
  const indexOf = (note: number) => nearestScaleIndex(scaleNotes, note);
  const clampIndex = (i: number) => Math.max(0, Math.min(scaleNotes.length - 1, i));

  switch (transform) {
    case 'retrograde': {
      // Play the motif's notes backwards, keeping the rests where they fall
      const played = motif.filter((n) => n > 0).reverse();
      let p = 0;
      for (let i = 0; i < motif.length; i++) if (motif[i] > 0) out[i] = played[p++];
      return out;
    }
    case 'invert': {
      // Mirror every interval around the motif's opening note
      const first = motif.find((n) => n > 0);
      if (first === undefined) return [...motif];
      const pivot = indexOf(first);
      for (let i = 0; i < motif.length; i++) {
        if (motif[i] <= 0) continue;
        out[i] = scaleNotes[clampIndex(pivot - (indexOf(motif[i]) - pivot))];
      }
      return out;
    }
    case 'augment': {
      // Thin to every other hit, so each note gets twice the space
      for (let i = 0; i < motif.length; i += 2) {
        if (motif[i] > 0) out[i] = motif[i];
      }
      return out;
    }
    case 'transpose': {
      const shift = indexOf(targetRoot) - indexOf(sourceRoot);
      for (let i = 0; i < motif.length; i++) {
        if (motif[i] <= 0) continue;
        out[i] = scaleNotes[clampIndex(indexOf(motif[i]) + shift)];
      }
      return out;
    }
    default:
      return [...motif];
  }
}

export function generateMotifLead(
  key: NoteName,
  scale: ScaleName,
  _density: number,
  progression: ChordProgression,
): ChannelData {
  const length = progression.chordAtRow.length;
  const scaleNotes = getScaleNotes(key, scale, 4, 5).map((n) => n.note);
  if (scaleNotes.length === 0) return [CH_LEAD, 0, ...Array(length).fill(0)];

  const rhythm = pick([
    [1, 0, 1, 0, 1, 0, 0, 0],
    [1, 0, 1, 1, 0, 0, 1, 0],
    [1, 1, 0, 1, 0, 0, 1, 0],
    [1, 0, 0, 1, 0, 1, 0, 0],
  ]);

  // Seed motif, built from the opening chord's tones
  const opening = progression.chordAtRow[0];
  const tones = [opening.rootMelody, opening.thirdMelody, opening.fifthMelody];
  const motif: number[] = Array(ROWS_PER_CHORD).fill(0);
  for (let i = 0; i < ROWS_PER_CHORD; i++) {
    if (!rhythm[i]) continue;
    motif[i] = i === 0 ? opening.rootMelody : pick(tones);
  }

  // Each following block restates the motif under a transformation
  const plan: MotifTransform[] = [
    'original', 'transpose', 'invert', 'transpose', 'retrograde', 'augment',
  ];
  const notes: number[] = Array(length).fill(0);
  let block = 0;

  eachBlock(progression, (start, blockLength, chord) => {
    const transform = block === 0 ? 'original' : plan[block % plan.length];
    const shaped = transformMotif(motif, transform, scaleNotes, chord.rootMelody, opening.rootMelody);
    for (let i = 0; i < blockLength; i++) notes[start + i] = shaped[i] ?? 0;
    block++;
  });

  return [CH_LEAD, 0, ...notes];
}

// --- POLYMETER --------------------------------------------------------------
// A figure whose period does not divide the pattern, so it drifts against the
// 4/4 drums and only realigns after several bars. Cheap to generate, and it
// sounds far more sophisticated than a repeating 8-row loop.

const POLY_PERIODS = [5, 6, 7, 9];

function polymeterFigure(period: number): number[] {
  const figure = Array(period).fill(0);
  figure[0] = 1; // always land on the figure's own downbeat
  for (let i = 1; i < period; i++) {
    if (Math.random() < 0.3) figure[i] = 1;
  }
  return figure;
}

export function generatePolymeterChannel(
  progression: ChordProgression,
  channelIndex: number,
  melodic: boolean,
): ChannelData {
  const length = progression.chordAtRow.length;
  const period = pick(POLY_PERIODS);
  const figure = polymeterFigure(period);
  const notes: number[] = Array(length).fill(0);

  for (let row = 0; row < length; row++) {
    if (!figure[row % period]) continue;
    const chord = progression.chordAtRow[row];
    // Chord tones follow the harmony under each hit, so the figure drifts
    // rhythmically while staying harmonically correct.
    const step = Math.floor(row / period) % 3;
    notes[row] = melodic
      ? [chord.rootMelody, chord.thirdMelody, chord.fifthMelody][step]
      : [chord.root, chord.fifth, chord.third][step];
  }

  return [channelIndex, 0, ...notes];
}

// --- CELLULAR AUTOMATA DRUMS ------------------------------------------------
// A 1D elementary automaton evolves one generation per row, and three fixed
// cells are tapped for kick, snare and hat. Rule 90 gives sparse Sierpinski
// figures, 30 is chaotic, 110 sits in between. The seed comes from the vibe's
// intensity so bar one still lands somewhere musical.

// Deliberately not a power of two. Rule 90 is XOR-based, and on a cyclic
// lattice whose width is a power of two it self-annihilates to all zeros
// within a few generations — the automaton dies and every hit lands in the
// first bar. An odd width gives long, live cycles instead.
const CA_WIDTH = 15;
// Structured rules only. Rule 30 and 150 are chaotic — roughly half the cells
// are alive at any moment, so a tap fires on nearly every row and the "beat"
// is a wall. 90 gives sparse Sierpinski figures, 110 is complex but ordered,
// 18 is sparse and fractal.
const CA_RULES = [90, 110, 18];

/** Ceiling on hits per row-count, so no rule can produce a wall of drums. */
const CA_DENSITY_CAP: Record<'kick' | 'snare' | 'hat', number> = {
  kick: 0.25,
  snare: 0.2,
  hat: 0.5,
};

/** Thin a hit set down to a density cap, keeping hits evenly spread. */
function capDensity(hits: Set<number>, length: number, cap: number): Set<number> {
  const max = Math.max(1, Math.floor(length * cap));
  if (hits.size <= max) return hits;
  const sorted = [...hits].sort((a, b) => a - b);
  const stride = sorted.length / max;
  const kept = new Set<number>();
  for (let i = 0; i < max; i++) kept.add(sorted[Math.floor(i * stride)]);
  return kept;
}

function caStep(cells: number[], rule: number): number[] {
  return cells.map((_, i) => {
    const l = cells[(i - 1 + cells.length) % cells.length];
    const c = cells[i];
    const r = cells[(i + 1) % cells.length];
    return (rule >> ((l << 2) | (c << 1) | r)) & 1;
  });
}

export function generateAutomataDrums(
  vibe: VibeName,
  length: number = DEFAULT_PATTERN_LENGTH,
): DrumChannels {
  const rule = pick(CA_RULES);

  // Classic single-cell seed — chaotic rules saturate from a busy start, and a
  // saturated automaton just fires on every row, which is a wall, not a beat.
  let cells: number[] = Array(CA_WIDTH).fill(0);
  cells[Math.floor(CA_WIDTH / 2)] = 1;
  const intensity = VIBE_CONFIG[vibe].drumIntensity;
  if (intensity === 'high' || intensity === 'intense') cells[2] = 1;

  let kicks = new Set<number>();
  let snares = new Set<number>();
  let hats = new Set<number>();

  for (let row = 0; row < length; row++) {
    let next = caStep(cells, rule);
    // Belt and braces: if the lattice dies anyway, reseed so the rest of the
    // pattern isn't silent.
    if (next.every((c) => c === 0)) {
      next = Array(CA_WIDTH).fill(0);
      next[(row * 5 + 1) % CA_WIDTH] = 1;
    }
    // Fire on a RISING edge rather than while a cell is simply alive: a live
    // cell can persist for many generations, which would hold the drum down.
    // Read a BAND of columns rather than one — whether any single column ever
    // lights up depends on the rule, which left some kits with no snare at all.
    const roseIn = (from: number, to: number) => {
      for (let i = from; i <= to; i++) if (next[i] === 1 && cells[i] === 0) return true;
      return false;
    };

    // Kicks avoid odd 16ths — they read as flams rather than beats
    if (roseIn(1, 4) && row % 2 === 0) kicks.add(row);
    if (roseIn(6, 9)) snares.add(row);
    if (roseIn(11, 14)) hats.add(row);
    cells = next;
  }

  kicks = capDensity(kicks, length, CA_DENSITY_CAP.kick);
  snares = capDensity(snares, length, CA_DENSITY_CAP.snare);
  hats = capDensity(hats, length, CA_DENSITY_CAP.hat);

  // Anchor the downbeat — without it the automaton can wander off the grid
  kicks.add(0);

  // Floor: some rules simply never light the snare band. A kit with no
  // backbeat isn't a kit, so fall back to one.
  if (snares.size < 2) {
    for (let row = DRUM_PERIOD / 4; row < length; row += DRUM_PERIOD / 2) snares.add(row);
  }

  const kickPattern: number[] = Array(length).fill(0);
  for (const row of kicks) kickPattern[row] = 1;

  return {
    channels: [
      drumChannelFromHits(kicks, CH_KICK, length),
      drumChannelFromHits(snares, CH_SNARE, length),
      drumChannelFromHits(hats, CH_HAT, length),
    ],
    kickPattern,
  };
}
