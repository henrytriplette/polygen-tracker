// Mutate: small, skeleton-preserving variations of one pattern — the tool for
// "this is almost right" instead of a full reroll.
import { DRUM_NOTES, Pattern, PatternLabel, Song } from './types';
import { getScaleNotes } from './scales';
import { progressionFromDegrees, CHORDS_PER_PATTERN } from './chords';

const ROWS = 32;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Replace a note with an adjacent tone from the scale pool. */
function neighborNote(note: number, pool: number[]): number {
  const idx = pool.findIndex((n) => n >= note);
  if (idx < 0) return note;
  const step = Math.random() < 0.5 ? -1 : 1;
  const target = Math.max(0, Math.min(pool.length - 1, idx + step));
  return pool[target];
}

export function mutatePattern(song: Song, label: PatternLabel): Pattern {
  const source = song.patterns[label];
  const pattern = source.map((c) => [...c]) as Pattern;
  const { key, scale } = song.config;

  const degrees =
    song.patternChords?.[label] ?? Array(CHORDS_PER_PATTERN).fill(0);
  const progression = progressionFromDegrees(degrees, key, scale);
  const scalePool = getScaleNotes(key, scale, 4, 5).map((n) => n.note);

  // Lead: nudge 1-3 notes to a scale neighbor
  const leadRows = [];
  for (let r = 0; r < ROWS; r++) if (pattern[0][r + 2] > 0) leadRows.push(r);
  const nudges = Math.min(leadRows.length, 1 + Math.floor(Math.random() * 3));
  for (let i = 0; i < nudges; i++) {
    const row = pick(leadRows);
    pattern[0][row + 2] = neighborNote(pattern[0][row + 2], scalePool);
  }

  // Harmony: 40% chance to move one hit to a different chord tone
  if (Math.random() < 0.4) {
    const rows = [];
    for (let r = 0; r < ROWS; r++) if (pattern[1][r + 2] > 0) rows.push(r);
    if (rows.length) {
      const row = pick(rows);
      const chord = progression.chordAtRow[row];
      pattern[1][row + 2] = pick([chord.rootMelody, chord.thirdMelody, chord.fifthMelody]);
    }
  }

  // Bass: 40% chance to swap one note between root and fifth
  if (Math.random() < 0.4) {
    const rows = [];
    for (let r = 0; r < ROWS; r++) if (pattern[2][r + 2] > 0) rows.push(r);
    if (rows.length) {
      const row = pick(rows);
      const chord = progression.chordAtRow[row];
      pattern[2][row + 2] = pattern[2][row + 2] === chord.root ? chord.fifth : chord.root;
    }
  }

  // Drums: one small change — add a ghost kick, add a hat, or drop a hat
  const roll = Math.random();
  const drumNotes = pattern[3];
  if (roll < 0.35) {
    const empty = [];
    for (let r = 0; r < ROWS; r++) if (r % 2 === 0 && drumNotes[r + 2] === 0) empty.push(r);
    if (empty.length) drumNotes[pick(empty) + 2] = DRUM_NOTES.KICK;
  } else if (roll < 0.7) {
    const empty = [];
    for (let r = 0; r < ROWS; r++) if (drumNotes[r + 2] === 0) empty.push(r);
    if (empty.length) drumNotes[pick(empty) + 2] = DRUM_NOTES.HAT;
  } else {
    const hats = [];
    for (let r = 0; r < ROWS; r++) if (drumNotes[r + 2] > DRUM_NOTES.SNARE + 8) hats.push(r);
    if (hats.length) drumNotes[pick(hats) + 2] = 0;
  }

  return pattern;
}
