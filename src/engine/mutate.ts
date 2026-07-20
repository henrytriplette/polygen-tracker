// Mutate: small, skeleton-preserving variations of one pattern — the tool for
// "this is almost right" instead of a full reroll.
import {
  CH_ARP,
  CH_BASS,
  CH_HARMONY,
  CH_HAT,
  CH_KICK,
  CH_LEAD,
  DRUM_HIT_NOTE,
  Pattern,
  PatternLabel,
  Song,
} from './types';
import { getScaleNotes } from './scales';
import { progressionFromDegrees, CHORDS_PER_PATTERN } from './chords';



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
  const ROWS = Math.max(0, (source[0]?.length ?? 2) - 2);

  const degrees =
    song.patternChords?.[label] ?? Array(CHORDS_PER_PATTERN).fill(0);
  const progression = progressionFromDegrees(degrees, key, scale, ROWS);
  const scalePool = getScaleNotes(key, scale, 4, 5).map((n) => n.note);

  const rowsWithNotes = (ch: number) => {
    const rows: number[] = [];
    for (let r = 0; r < ROWS; r++) if (pattern[ch][r + 2] > 0) rows.push(r);
    return rows;
  };

  // Lead: nudge 1-3 notes to a scale neighbor
  const leadRows = rowsWithNotes(CH_LEAD);
  const nudges = Math.min(leadRows.length, 1 + Math.floor(Math.random() * 3));
  for (let i = 0; i < nudges; i++) {
    const row = pick(leadRows);
    pattern[CH_LEAD][row + 2] = neighborNote(pattern[CH_LEAD][row + 2], scalePool);
  }

  // Harmony / arp: 40% chance each to move one hit to a different chord tone
  for (const ch of [CH_HARMONY, CH_ARP]) {
    if (Math.random() >= 0.4) continue;
    const rows = rowsWithNotes(ch);
    if (!rows.length) continue;
    const row = pick(rows);
    const chord = progression.chordAtRow[row];
    pattern[ch][row + 2] = pick([chord.rootMelody, chord.thirdMelody, chord.fifthMelody]);
  }

  // Bass: 40% chance to swap one note between root and fifth
  if (Math.random() < 0.4) {
    const rows = rowsWithNotes(CH_BASS);
    if (rows.length) {
      const row = pick(rows);
      const chord = progression.chordAtRow[row];
      pattern[CH_BASS][row + 2] = pattern[CH_BASS][row + 2] === chord.root ? chord.fifth : chord.root;
    }
  }

  // Drums: one small change — a ghost kick, an extra hat, or drop a hat
  const roll = Math.random();
  const emptyRows = (ch: number, evenOnly = false) => {
    const rows: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      if (pattern[ch][r + 2] === 0 && (!evenOnly || r % 2 === 0)) rows.push(r);
    }
    return rows;
  };

  if (roll < 0.35) {
    const empty = emptyRows(CH_KICK, true);
    if (empty.length) pattern[CH_KICK][pick(empty) + 2] = DRUM_HIT_NOTE;
  } else if (roll < 0.7) {
    const empty = emptyRows(CH_HAT);
    if (empty.length) pattern[CH_HAT][pick(empty) + 2] = DRUM_HIT_NOTE;
  } else {
    const hats = rowsWithNotes(CH_HAT);
    if (hats.length) pattern[CH_HAT][pick(hats) + 2] = 0;
  }

  return pattern;
}
