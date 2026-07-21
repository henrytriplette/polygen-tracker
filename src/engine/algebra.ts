// Pattern algebra: transformations as composable values.
//
// The motif generator already performed transpose / invert / retrograde /
// augment internally, but they were not addressable — you could ask for a
// motif, not for "invert then retrograde this selection". This module makes
// each one a plain function over a note row so they can be composed, named,
// and applied to any selection.
//
// The representation is the same one the patterns use: an array of zzfxm note
// numbers where 0 is a rest and 12 is C4. Every transform is total (it always
// returns a row of the same length) and pure, so chains cannot half-apply.
import { snapNoteToScale } from './scales';
import type { NoteName, ScaleName } from './types';

/** A transform maps one row of notes to another of the same length. */
export type NoteRow = number[];
export type Transform = (row: NoteRow) => NoteRow;

export interface TransformDef {
  id: string;
  label: string;
  /** Does this take a numeric argument, and what does it mean? */
  arg?: { label: string; min: number; max: number; default: number };
  hint: string;
  make: (arg: number) => Transform;
}

const isRest = (note: number) => !note || note <= 0;

/** Lowest and highest sounding notes, or null when the row is silent. */
function noteRange(row: NoteRow): { low: number; high: number } | null {
  let low: number | null = null;
  let high: number | null = null;
  for (const note of row) {
    if (isRest(note)) continue;
    if (low === null || note < low) low = note;
    if (high === null || note > high) high = note;
  }
  return low === null || high === null ? null : { low, high };
}

/** Map over sounding notes, leaving rests exactly where they are. */
function mapNotes(row: NoteRow, fn: (note: number) => number): NoteRow {
  return row.map((note) => (isRest(note) ? note : Math.max(1, Math.round(fn(note)))));
}

// --- The transforms ---------------------------------------------------------

export const transpose = (semitones: number): Transform =>
  (row) => mapNotes(row, (note) => note + semitones);

/**
 * Mirror the pitch contour: intervals that rose now fall by the same amount.
 *
 * The axis is the midpoint of the row's own range, so the lowest note becomes
 * the highest and the register is preserved. That choice also makes inversion
 * involutive — inverting twice returns the original — which an axis of, say,
 * the lowest note would not, because the axis itself would move. In a
 * composable algebra that predictability matters more than the exact axis.
 */
export const invert = (): Transform => (row) => {
  const range = noteRange(row);
  if (!range) return [...row];
  const twiceAxis = range.low + range.high; // 2 * midpoint, always an integer
  return mapNotes(row, (note) => twiceAxis - note);
};

/** Play the row backwards. Rests move with the notes, so rhythm reverses too. */
export const retrograde = (): Transform => (row) => [...row].reverse();

/**
 * Stretch the rhythm by a whole-number factor: each note is held for `factor`
 * steps and the tail that no longer fits is dropped. Length is preserved, so
 * augmenting a full row necessarily loses its end — that is the musical
 * meaning, not a truncation bug.
 */
export const augment = (factor: number): Transform => (row) => {
  const f = Math.max(2, Math.round(factor));
  const out: NoteRow = new Array(row.length).fill(0);
  let write = 0;
  for (const note of row) {
    if (write >= row.length) break;
    if (!isRest(note)) out[write] = note;
    write += f;
  }
  return out;
};

/** Compress the rhythm: keep every `factor`-th step, then repeat to fill. */
export const diminish = (factor: number): Transform => (row) => {
  const f = Math.max(2, Math.round(factor));
  const kept: NoteRow = [];
  for (let i = 0; i < row.length; i += f) kept.push(row[i] ?? 0);
  const out: NoteRow = new Array(row.length).fill(0);
  for (let i = 0; i < row.length; i++) out[i] = kept[i % kept.length] ?? 0;
  return out;
};

/** Rotate in time, wrapping around. Negative rotates earlier. */
export const rotate = (steps: number): Transform => (row) => {
  const n = row.length;
  if (n === 0) return [];
  const shift = ((Math.round(steps) % n) + n) % n;
  return row.map((_, i) => row[(i - shift + n) % n]);
};

/** Drop notes, keeping every `keepEvery`-th sounding one. Thins without moving. */
export const thin = (keepEvery: number): Transform => (row) => {
  const every = Math.max(2, Math.round(keepEvery));
  let seen = 0;
  return row.map((note) => {
    if (isRest(note)) return note;
    return seen++ % every === 0 ? note : 0;
  });
};

/** Force every sounding note into the given scale. */
export const snapToScale = (key: NoteName, scale: ScaleName): Transform =>
  (row) => mapNotes(row, (note) => snapNoteToScale(note, key, scale));

// --- Composition ------------------------------------------------------------

/**
 * Left-to-right composition: `chain(a, b)` applies a, then b. Reads in the
 * order it is written, which matters when these are shown to a user as a list.
 */
export function chain(...transforms: Transform[]): Transform {
  return (row) => transforms.reduce((acc, transform) => transform(acc), row);
}

/** The transforms offered in the UI, with their argument metadata. */
export const TRANSFORMS: TransformDef[] = [
  {
    id: 'transpose', label: 'TRANSPOSE',
    arg: { label: 'semitones', min: -24, max: 24, default: 12 },
    hint: 'Shift every note by a number of semitones',
    make: (v) => transpose(v),
  },
  {
    id: 'invert', label: 'INVERT',
    hint: 'Mirror the melody around its lowest note — rises become falls',
    make: () => invert(),
  },
  {
    id: 'retrograde', label: 'RETROGRADE',
    hint: 'Play the phrase backwards, rhythm included',
    make: () => retrograde(),
  },
  {
    id: 'augment', label: 'AUGMENT',
    arg: { label: 'factor', min: 2, max: 4, default: 2 },
    hint: 'Stretch the rhythm — half speed at factor 2',
    make: (v) => augment(v),
  },
  {
    id: 'diminish', label: 'DIMINISH',
    arg: { label: 'factor', min: 2, max: 4, default: 2 },
    hint: 'Compress the rhythm and repeat it to fill the row',
    make: (v) => diminish(v),
  },
  {
    id: 'rotate', label: 'ROTATE',
    arg: { label: 'steps', min: -32, max: 32, default: 4 },
    hint: 'Shift the phrase in time, wrapping around the row',
    make: (v) => rotate(v),
  },
  {
    id: 'thin', label: 'THIN',
    arg: { label: 'keep 1 in', min: 2, max: 8, default: 2 },
    hint: 'Remove notes without moving the ones that remain',
    make: (v) => thin(v),
  },
];

export function findTransform(id: string): TransformDef | null {
  return TRANSFORMS.find((t) => t.id === id) ?? null;
}

/** One step of a saved macro. */
export interface MacroStep {
  id: string;
  arg?: number;
}

/** Build a single transform from a macro definition. */
export function macroToTransform(steps: MacroStep[]): Transform {
  const transforms = steps
    .map((step) => {
      const def = findTransform(step.id);
      if (!def) return null;
      return def.make(step.arg ?? def.arg?.default ?? 0);
    })
    .filter((t): t is Transform => t !== null);
  return chain(...transforms);
}

/** Human-readable description of a macro, e.g. "INVERT -> TRANSPOSE 7". */
export function describeMacro(steps: MacroStep[]): string {
  return steps
    .map((step) => {
      const def = findTransform(step.id);
      if (!def) return step.id;
      const arg = step.arg ?? def.arg?.default;
      return def.arg ? `${def.label} ${arg}` : def.label;
    })
    .join(' -> ');
}
