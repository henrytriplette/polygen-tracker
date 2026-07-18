import {
  VibeName, NoteName, ScaleName,
  CHORD_SEGMENTS, DEFAULT_PATTERN_LENGTH, rowsPerChord,
} from './types';
import { CHROMATIC, SCALES, noteToZzfxm } from './scales';

// Chord quality: which scale degrees make up the chord (0-indexed from chord root)
// In a 7-note scale, triad = root + 2 degrees up + 4 degrees up
type ChordDegree = number; // scale degree index (0 = root of key)

// Progressions as arrays of scale degree roots (0-indexed)
// e.g., [0, 4, 5, 3] = I-V-vi-IV in major
interface Progression {
  degrees: number[];
  weight: number; // selection probability weight
}

const PROGRESSIONS: Record<VibeName, Progression[]> = {
  adventure: [
    { degrees: [0, 4, 5, 3], weight: 3 },  // I-V-vi-IV (pop/adventure classic)
    { degrees: [0, 3, 4, 0], weight: 2 },  // I-IV-V-I (strong resolution)
    { degrees: [0, 5, 3, 4], weight: 2 },  // I-vi-IV-V (50s progression)
    { degrees: [0, 3, 0, 4], weight: 1 },  // I-IV-I-V
  ],
  battle: [
    { degrees: [0, 2, 6, 5], weight: 3 },  // i-III-VII-VI (epic minor)
    { degrees: [0, 3, 4, 0], weight: 2 },  // i-iv-V-i
    { degrees: [0, 6, 5, 4], weight: 2 },  // i-VII-VI-V (descending)
    { degrees: [0, 4, 3, 6], weight: 1 },  // i-v-iv-VII
  ],
  dungeon: [
    { degrees: [0, 3, 0, 4], weight: 3 },  // i-iv-i-v (brooding)
    { degrees: [0, 6, 0, 5], weight: 2 },  // i-VII-i-VI (dark)
    { degrees: [0, 5, 3, 4], weight: 2 },  // i-VI-iv-v
    { degrees: [0, 3, 5, 6], weight: 1 },  // i-iv-VI-VII
  ],
  titleScreen: [
    { degrees: [0, 4, 5, 3], weight: 3 },  // I-V-vi-IV
    { degrees: [0, 3, 4, 0], weight: 3 },  // I-IV-V-I
    { degrees: [0, 5, 3, 4], weight: 2 },  // I-vi-IV-V
    { degrees: [0, 2, 3, 4], weight: 1 },  // I-iii-IV-V
  ],
  boss: [
    { degrees: [0, 6, 5, 6], weight: 3 },  // i-VII-VI-VII (driving)
    { degrees: [0, 2, 5, 4], weight: 2 },  // i-III-VI-V (dramatic)
    { degrees: [0, 4, 3, 6], weight: 2 },  // i-v-iv-VII
    { degrees: [0, 3, 6, 4], weight: 1 },  // i-iv-VII-v
  ],
  synthwave: [
    { degrees: [0, 5, 2, 6], weight: 3 },  // i-VI-III-VII (the retrowave loop)
    { degrees: [0, 5, 3, 6], weight: 2 },  // i-VI-iv-VII
    { degrees: [0, 3, 5, 6], weight: 2 },  // i-iv-VI-VII (rising night drive)
    { degrees: [0, 6, 5, 2], weight: 1 },  // i-VII-VI-III
  ],
  house: [
    { degrees: [0, 5, 0, 6], weight: 3 },  // i-VI-i-VII (two-chord pump)
    { degrees: [0, 3, 0, 5], weight: 2 },  // i-iv-i-VI (deep house sway)
    { degrees: [0, 5, 2, 6], weight: 2 },  // i-VI-III-VII
    { degrees: [0, 6, 0, 6], weight: 1 },  // i-VII loop (hypnotic)
  ],
  lofi: [
    { degrees: [1, 4, 0, 0], weight: 3 },  // ii-V-I-I (the jazz cadence)
    { degrees: [1, 4, 0, 5], weight: 2 },  // ii-V-I-vi (turnaround)
    { degrees: [0, 3, 1, 4], weight: 2 },  // I-IV-ii-V (gentle cycle)
    { degrees: [0, 5, 3, 4], weight: 1 },  // I-vi-IV-V (nostalgic)
  ],
  funk: [
    { degrees: [0, 0, 3, 0], weight: 3 },  // one-chord vamp with iv color
    { degrees: [0, 3, 0, 4], weight: 2 },  // i-IV-i-v (dorian vamp)
    { degrees: [0, 0, 5, 6], weight: 2 },  // vamp with VI-VII horn hits
    { degrees: [0, 6, 3, 0], weight: 1 },  // i-VII-iv-i
  ],
  punk: [
    { degrees: [0, 3, 4, 4], weight: 3 },  // I-IV-V-V (three chords, the truth)
    { degrees: [0, 4, 5, 3], weight: 3 },  // I-V-vi-IV (pop-punk anthem)
    { degrees: [0, 3, 0, 4], weight: 2 },  // I-IV-I-V (ramones-core)
    { degrees: [0, 5, 3, 4], weight: 1 },  // I-vi-IV-V
  ],
  techno: [
    { degrees: [0, 0, 0, 5], weight: 3 },  // near-static drone, late shift
    { degrees: [0, 0, 3, 0], weight: 2 },  // hypnotic i with iv color
    { degrees: [0, 5, 0, 6], weight: 2 },  // minimal two-chord swing
    { degrees: [0, 0, 0, 0], weight: 1 },  // pure drone
  ],
  dub: [
    { degrees: [0, 3, 0, 3], weight: 3 },  // i-iv riddim rock
    { degrees: [0, 0, 3, 3], weight: 2 },  // two bars each, heavy sway
    { degrees: [0, 5, 0, 3], weight: 2 },  // i-VI-i-iv roots motion
    { degrees: [0, 3, 4, 0], weight: 1 },  // i-iv-v-i turnaround
  ],
  idm: [
    { degrees: [0, 1, 5, 4], weight: 2 },  // stepwise oddness
    { degrees: [0, 2, 6, 1], weight: 2 },  // unresolved wandering
    { degrees: [0, 5, 1, 6], weight: 2 },  // sidesteps
    { degrees: [0, 4, 2, 5], weight: 2 },  // no home base
  ],
  hardcore: [
    { degrees: [0, 0, 6, 6], weight: 3 },  // two-riff hammer
    { degrees: [0, 6, 0, 6], weight: 2 },  // i-VII seesaw
    { degrees: [0, 5, 6, 0], weight: 2 },  // rave riff cycle
    { degrees: [0, 0, 0, 6], weight: 1 },  // one riff, late flip
  ],
  dnb: [
    { degrees: [0, 5, 3, 6], weight: 3 },  // moody rolling minor
    { degrees: [0, 3, 0, 5], weight: 2 },  // deep two-chord roll
    { degrees: [0, 5, 2, 6], weight: 2 },  // liquid motion
    { degrees: [0, 6, 3, 5], weight: 1 },  // darker turn
  ],
};

export interface ChordInfo {
  root: number;        // ZzFXM note value for chord root (bass octave)
  third: number;       // ZzFXM note value for chord 3rd
  fifth: number;       // ZzFXM note value for chord 5th
  rootMelody: number;  // chord root in melody octave
  thirdMelody: number; // chord 3rd in melody octave
  fifthMelody: number; // chord 5th in melody octave
}

export interface ChordProgression {
  chords: ChordInfo[];       // 4 chords
  chordAtRow: ChordInfo[];   // 32 entries, one per row
}

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

// Build a triad from a scale degree
function buildChord(
  degree: number,
  rootName: NoteName,
  scale: ScaleName,
  bassOctave: number,
  melodyOctave: number
): ChordInfo {
  const rootIdx = CHROMATIC.indexOf(rootName);
  const intervals = SCALES[scale];

  // Get the chromatic index of the chord root
  const chordRootInterval = intervals[degree % intervals.length];
  const chordRootChromatic = (rootIdx + chordRootInterval) % 12;

  // 3rd = 2 scale degrees above chord root
  const thirdDegree = (degree + 2) % intervals.length;
  const thirdInterval = intervals[thirdDegree];
  const thirdChromatic = (rootIdx + thirdInterval) % 12;

  // 5th = 4 scale degrees above chord root
  const fifthDegree = (degree + 4) % intervals.length;
  const fifthInterval = intervals[fifthDegree];
  const fifthChromatic = (rootIdx + fifthInterval) % 12;

  // Calculate octave adjustments (3rd/5th may wrap around)
  const thirdOctaveAdj = thirdChromatic < chordRootChromatic ? 1 : 0;
  const fifthOctaveAdj = fifthChromatic < chordRootChromatic ? 1 : 0;

  // zzfxm note 0 means "rest", so C in the bass octave (C3) is unplayable.
  // Shift the whole bass chord up an octave when that happens, otherwise
  // C-rooted chords silently lose their bass notes.
  const root = noteToZzfxm(chordRootChromatic, bassOctave);
  const bassShift = root <= 0 ? 1 : 0;

  return {
    root: noteToZzfxm(chordRootChromatic, bassOctave + bassShift),
    third: noteToZzfxm(thirdChromatic, bassOctave + bassShift + thirdOctaveAdj),
    fifth: noteToZzfxm(fifthChromatic, bassOctave + bassShift + fifthOctaveAdj),
    rootMelody: noteToZzfxm(chordRootChromatic, melodyOctave),
    thirdMelody: noteToZzfxm(thirdChromatic, melodyOctave + thirdOctaveAdj),
    fifthMelody: noteToZzfxm(fifthChromatic, melodyOctave + fifthOctaveAdj),
  };
}

/** Pick a weighted random progression (as scale degrees) for a vibe. */
export function randomProgressionDegrees(vibe: VibeName): number[] {
  return [...pickWeighted(PROGRESSIONS[vibe]).degrees];
}

/**
 * Build a playable progression from explicit scale degrees (user-editable).
 * The chords always split the pattern into four equal segments, so
 * `chordAtRow.length` doubles as the pattern length for the generators.
 */
export function progressionFromDegrees(
  degrees: number[],
  key: NoteName,
  scale: ScaleName,
  length: number = DEFAULT_PATTERN_LENGTH
): ChordProgression {
  const chords = degrees.map(degree => buildChord(degree, key, scale, 3, 4));

  const perChord = rowsPerChord(length);
  const chordAtRow: ChordInfo[] = [];
  for (let i = 0; i < length; i++) {
    const chordIdx = Math.min(Math.floor(i / perChord), chords.length - 1);
    chordAtRow.push(chords[chordIdx]);
  }

  return { chords, chordAtRow };
}

export function generateChordProgression(
  vibe: VibeName,
  key: NoteName,
  scale: ScaleName,
  length: number = DEFAULT_PATTERN_LENGTH
): ChordProgression {
  return progressionFromDegrees(randomProgressionDegrees(vibe), key, scale, length);
}

/**
 * Human-readable chord name for a scale degree in a key/scale,
 * e.g. degree 0 in C major -> "C", degree 1 -> "Dm", degree 6 -> "B°".
 */
export function chordDisplayName(degree: number, key: NoteName, scale: ScaleName): string {
  const rootIdx = CHROMATIC.indexOf(key);
  const intervals = SCALES[scale];
  const len = intervals.length;

  const rootInterval = intervals[degree % len];
  const thirdInterval = intervals[(degree + 2) % len];
  const fifthInterval = intervals[(degree + 4) % len];

  const rootName = CHROMATIC[(rootIdx + rootInterval) % 12];
  const thirdSemis = (thirdInterval - rootInterval + 12) % 12;
  const fifthSemis = (fifthInterval - rootInterval + 12) % 12;

  let quality = '';
  if (thirdSemis === 3) quality = fifthSemis === 6 ? '°' : 'm';
  else if (thirdSemis === 4 && fifthSemis === 8) quality = '+';

  return `${rootName}${quality}`;
}

/** Number of chords a pattern progression holds (one per 8 rows). */
export const CHORDS_PER_PATTERN = CHORD_SEGMENTS;
