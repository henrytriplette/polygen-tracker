// Markov chains for melody and harmony.
//
// Two uses:
//  1. Hand-tuned priors — per-vibe tables describing how a style tends to move
//     (lofi steps and repeats, IDM leaps, techno barely moves).
//  2. Learned tables — count the transitions in music that already exists and
//     resample it, producing "more of the same dialect".
//
// Everything draws from Math.random so seeded generation still reproduces.
import type { VibeName } from './types';

/** value -> relative weight */
export type WeightTable = Map<number, number>;
/** state -> possible next values */
export type MarkovTable = Map<number, WeightTable>;

export function pickWeighted(weights: WeightTable, fallback: number): number {
  let total = 0;
  for (const w of weights.values()) total += w;
  if (total <= 0) return fallback;

  let r = Math.random() * total;
  for (const [value, w] of weights) {
    r -= w;
    if (r <= 0) return value;
  }
  return fallback;
}

/** Next state from the chain, falling back when the state is unseen. */
export function step(table: MarkovTable, state: number, fallback: number): number {
  const row = table.get(state);
  if (!row || row.size === 0) return fallback;
  return pickWeighted(row, fallback);
}

/** Count order-1 transitions in a sequence into a table. */
export function learnTransitions(sequence: number[]): MarkovTable {
  const table: MarkovTable = new Map();
  for (let i = 0; i < sequence.length - 1; i++) {
    const from = sequence[i];
    const to = sequence[i + 1];
    let row = table.get(from);
    if (!row) {
      row = new Map();
      table.set(from, row);
    }
    row.set(to, (row.get(to) ?? 0) + 1);
  }
  return table;
}

/** Flatten every transition into one distribution — used when a state is unseen. */
export function marginalDistribution(table: MarkovTable): WeightTable {
  const flat: WeightTable = new Map();
  for (const row of table.values()) {
    for (const [value, w] of row) flat.set(value, (flat.get(value) ?? 0) + w);
  }
  return flat;
}

function toWeightTable(record: Record<number, number>): WeightTable {
  return new Map(Object.entries(record).map(([k, v]) => [Number(k), v]));
}

// --- MELODIC STYLES ---------------------------------------------------------
// Weights over interval steps measured in SCALE DEGREES (not semitones), so
// every move stays diatonic. 0 = repeat the note.

export interface MelodicStyle {
  /** Interval -> weight. */
  intervals: WeightTable;
  /**
   * How strongly a leap is answered by a step in the opposite direction —
   * the classic "gap fill" principle that keeps a random walk singable.
   */
  leapRecovery: number;
  /** Chance a note on a block's downbeat snaps to a chord tone. */
  chordSnap: number;
}

function style(
  intervals: Record<number, number>,
  leapRecovery: number,
  chordSnap: number,
): MelodicStyle {
  return { intervals: toWeightTable(intervals), leapRecovery, chordSnap };
}

export const MELODIC_STYLES: Record<string, MelodicStyle> = {
  // Mostly stepwise with occasional thirds — song-like
  stepwise: style({ 0: 2, 1: 5, [-1]: 5, 2: 2, [-2]: 2, 3: 1, [-3]: 1 }, 0.75, 0.7),
  // Hovers around a centre, lots of repeated notes — hypnotic
  static: style({ 0: 7, 1: 4, [-1]: 4, 2: 1, [-2]: 1 }, 0.5, 0.8),
  // Wide, unpredictable motion — IDM / boss leads
  leapy: style({ 0: 1, 1: 2, [-1]: 2, 2: 3, [-2]: 3, 3: 3, [-3]: 3, 4: 2, [-4]: 2, 5: 1, [-5]: 1 }, 0.85, 0.5),
  // Energetic but still singable — battle / punk
  driving: style({ 0: 2, 1: 4, [-1]: 4, 2: 3, [-2]: 3, 3: 2, [-3]: 2, 4: 1, [-4]: 1 }, 0.8, 0.65),
  // Arpeggio-leaning: thirds dominate — chiptune arpeggio feel
  triadic: style({ 0: 1, 1: 2, [-1]: 2, 2: 5, [-2]: 5, 4: 2, [-4]: 2 }, 0.7, 0.75),
};

export const VIBE_MELODIC_STYLE: Record<VibeName, keyof typeof MELODIC_STYLES> = {
  adventure: 'stepwise',
  battle: 'driving',
  dungeon: 'static',
  titleScreen: 'stepwise',
  boss: 'leapy',
  synthwave: 'stepwise',
  house: 'triadic',
  techno: 'static',
  dub: 'static',
  idm: 'leapy',
  hardcore: 'driving',
  dnb: 'triadic',
  lofi: 'static',
  funk: 'driving',
  punk: 'driving',
};

export function melodicStyleFor(vibe: VibeName): MelodicStyle {
  return MELODIC_STYLES[VIBE_MELODIC_STYLE[vibe]] ?? MELODIC_STYLES.stepwise;
}

// --- HARMONIC STYLES --------------------------------------------------------
// Transition weights between scale degrees (0 = I/i .. 6 = vii). These encode
// how chords actually tend to follow one another in each idiom.

export type HarmonicTable = MarkovTable;

function harmonic(rows: Record<number, Record<number, number>>): HarmonicTable {
  const table: HarmonicTable = new Map();
  for (const [from, tos] of Object.entries(rows)) {
    table.set(Number(from), toWeightTable(tos));
  }
  return table;
}

export const HARMONIC_STYLES: Record<string, HarmonicTable> = {
  // Classic functional motion: predominant -> dominant -> tonic, with the
  // occasional deceptive cadence.
  functional: harmonic({
    0: { 4: 3, 3: 3, 5: 2, 1: 2, 2: 1 },
    1: { 4: 5, 0: 1, 3: 1 },
    2: { 5: 3, 3: 2, 0: 1 },
    3: { 0: 3, 4: 3, 1: 1, 5: 1 },
    4: { 0: 6, 5: 2, 3: 1 },       // V->I, sometimes V->vi
    5: { 3: 3, 1: 3, 4: 2, 0: 1 },
    6: { 0: 5, 4: 1 },
  }),
  // Loop-based: strong pull back to the tonic, few distinct chords.
  modal: harmonic({
    0: { 0: 3, 6: 3, 5: 3, 3: 2 },
    3: { 0: 4, 6: 1 },
    5: { 0: 3, 6: 3, 3: 1 },
    6: { 0: 4, 5: 2 },
    1: { 0: 3, 4: 1 },
    2: { 0: 3, 5: 1 },
    4: { 0: 3, 5: 1 },
  }),
  // Almost static — one chord with rare colour changes (techno, dub).
  drone: harmonic({
    0: { 0: 8, 5: 2, 6: 2, 3: 1 },
    3: { 0: 6 },
    5: { 0: 6, 6: 1 },
    6: { 0: 6, 5: 1 },
    1: { 0: 6 },
    2: { 0: 6 },
    4: { 0: 6 },
  }),
  // Restless: sidesteps and unresolved motion (IDM, boss).
  wandering: harmonic({
    0: { 1: 2, 2: 2, 5: 2, 6: 2, 3: 1, 4: 1 },
    1: { 4: 2, 5: 2, 2: 1, 6: 1 },
    2: { 5: 2, 1: 2, 6: 1, 3: 1 },
    3: { 6: 2, 1: 2, 4: 1, 0: 1 },
    4: { 5: 2, 2: 2, 0: 1, 3: 1 },
    5: { 2: 2, 6: 2, 3: 1, 1: 1 },
    6: { 3: 2, 0: 2, 5: 1, 2: 1 },
  }),
};

export const VIBE_HARMONIC_STYLE: Record<VibeName, keyof typeof HARMONIC_STYLES> = {
  adventure: 'functional',
  battle: 'functional',
  dungeon: 'modal',
  titleScreen: 'functional',
  boss: 'wandering',
  synthwave: 'modal',
  house: 'modal',
  techno: 'drone',
  dub: 'drone',
  idm: 'wandering',
  hardcore: 'modal',
  dnb: 'modal',
  lofi: 'functional',
  funk: 'drone',
  punk: 'functional',
};

/**
 * Walk a harmonic chain to produce `count` scale degrees, always starting on
 * the tonic so the progression has somewhere to come home to.
 */
export function markovProgressionDegrees(vibe: VibeName, count: number): number[] {
  const table = HARMONIC_STYLES[VIBE_HARMONIC_STYLE[vibe]] ?? HARMONIC_STYLES.functional;
  const degrees = [0];
  for (let i = 1; i < count; i++) {
    degrees.push(step(table, degrees[i - 1], 0));
  }
  return degrees;
}
