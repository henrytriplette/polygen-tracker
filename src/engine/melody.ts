import { NoteName, ScaleName, ChannelData, VibeName, RHYTHM_PERIOD, rowsPerChord } from './types';
import { getScaleNotes } from './scales';
import { ChordProgression } from './chords';
import {
  MarkovTable,
  MelodicStyle,
  learnTransitions,
  marginalDistribution,
  melodicStyleFor,
  pickWeighted,
} from './markov';

const ROWS_PER_CHORD = RHYTHM_PERIOD; // one phrase block

// Melody rhythm templates — where notes land within an 8-row chord segment
// These create recognizable, musical phrase shapes
const RHYTHM_TEMPLATES = [
  [1, 0, 1, 0, 1, 0, 1, 0],  // steady eighth notes
  [1, 0, 0, 1, 1, 0, 0, 1],  // syncopated
  [1, 0, 1, 0, 1, 0, 0, 0],  // front-heavy (rest at end)
  [1, 0, 0, 1, 0, 0, 1, 0],  // dotted feel
  [1, 1, 0, 1, 1, 0, 1, 0],  // driving
  [1, 0, 1, 1, 0, 1, 0, 0],  // triplet-ish
];

// Sparse templates for dungeon/ambient vibes
const SPARSE_RHYTHM_TEMPLATES = [
  [1, 0, 0, 0, 1, 0, 0, 0],  // half notes
  [1, 0, 0, 0, 0, 0, 1, 0],  // wide spacing
  [1, 0, 0, 1, 0, 0, 0, 0],  // two hits
  [1, 0, 0, 0, 0, 1, 0, 0],  // offset pair
];

// Dense templates for battle/boss vibes
const DENSE_RHYTHM_TEMPLATES = [
  [1, 1, 1, 0, 1, 1, 1, 0],  // running notes
  [1, 0, 1, 1, 1, 0, 1, 1],  // driving sixteenths
  [1, 1, 0, 1, 1, 0, 1, 1],  // gallop
  [1, 1, 1, 1, 0, 1, 1, 0],  // burst + rest
];

function pickRhythm(density: number): number[] {
  if (density < 0.35) {
    return SPARSE_RHYTHM_TEMPLATES[Math.floor(Math.random() * SPARSE_RHYTHM_TEMPLATES.length)];
  }
  if (density > 0.65) {
    return DENSE_RHYTHM_TEMPLATES[Math.floor(Math.random() * DENSE_RHYTHM_TEMPLATES.length)];
  }
  return RHYTHM_TEMPLATES[Math.floor(Math.random() * RHYTHM_TEMPLATES.length)];
}

// Generate a melodic phrase for one chord segment (8 rows)
// Phrases are built around chord tones with passing scale notes
function generatePhrase(
  chordRoot: number,
  chordThird: number,
  chordFifth: number,
  rhythm: number[],
  scaleNotes: number[],
): number[] {
  const phrase: number[] = Array(ROWS_PER_CHORD).fill(0);
  const chordTones = [chordRoot, chordThird, chordFifth];

  // Find nearby scale notes for passing tones
  const nearbyNotes = scaleNotes.filter(
    n => n >= chordRoot - 2 && n <= chordFifth + 4
  );

  let hitCount = 0;
  const totalHits = rhythm.filter(r => r).length;

  for (let i = 0; i < ROWS_PER_CHORD; i++) {
    if (!rhythm[i]) continue;

    hitCount++;

    if (hitCount === 1) {
      // First note: always a chord tone (usually root or 3rd)
      phrase[i] = Math.random() < 0.6 ? chordRoot : chordThird;
    } else if (hitCount === totalHits) {
      // Last note: chord tone (creates resolution)
      phrase[i] = chordTones[Math.floor(Math.random() * chordTones.length)];
    } else if (Math.random() < 0.5) {
      // 50% chord tone
      phrase[i] = chordTones[Math.floor(Math.random() * chordTones.length)];
    } else {
      // 50% passing scale tone
      if (nearbyNotes.length > 0) {
        phrase[i] = nearbyNotes[Math.floor(Math.random() * nearbyNotes.length)];
      } else {
        phrase[i] = chordRoot;
      }
    }
  }

  return phrase;
}

export function generateMelodyPattern(
  key: NoteName,
  scale: ScaleName,
  density: number,
  progression: ChordProgression
): ChannelData {
  // The progression spans the whole pattern, so it tells us the length.
  const length = progression.chordAtRow.length;
  const perChord = rowsPerChord(length);

  const scaleNotes = getScaleNotes(key, scale, 4, 5).map(n => n.note);
  if (scaleNotes.length === 0) {
    return [0, 0, ...Array(length).fill(0)];
  }

  // Two rhythm templates alternating per chord segment gives ABAB phrasing.
  const rhythmA = pickRhythm(density);
  const rhythmB = pickRhythm(density);

  // Phrases are built one RHYTHM_PERIOD block at a time so the groove keeps
  // its period no matter how long the pattern is.
  const notes: number[] = Array(length).fill(0);
  for (let start = 0; start < length; start += RHYTHM_PERIOD) {
    const blockLength = Math.min(RHYTHM_PERIOD, length - start);
    const chordIdx = Math.min(Math.floor(start / perChord), progression.chords.length - 1);
    const chord = progression.chords[chordIdx];
    const rhythm = Math.floor(start / perChord) % 2 === 0 ? rhythmA : rhythmB;

    const phrase = generatePhrase(
      chord.rootMelody,
      chord.thirdMelody,
      chord.fifthMelody,
      rhythm,
      scaleNotes,
    );
    for (let i = 0; i < blockLength; i++) notes[start + i] = phrase[i];
  }

  // Repetition pass: 30% chance to restate the opening phrase halfway through,
  // which is what makes a melody feel like a theme rather than a walk.
  if (Math.random() < 0.3) {
    const half = Math.floor(length / 2);
    for (let i = 0; i < Math.min(perChord, length - half); i++) {
      notes[half + i] = notes[i];
    }
  }

  return [0, 0, ...notes];
}

// --- MARKOV MELODY ----------------------------------------------------------
// A random walk over scale degrees, shaped by three things that keep it from
// sounding like noise:
//   1. per-style interval weights (how far this idiom likes to move)
//   2. gap fill — a leap is usually answered by a step the other way
//   3. chord-tone snapping on block downbeats, so it stays inside the harmony
//
// The transition table is either a hand-tuned prior for the vibe, or one
// learned from notes that already exist (see learnMelodyTable).

/** Nearest index in the scale array to a given note. */
function nearestIndex(scaleNotes: number[], note: number): number {
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

/**
 * Learn interval transitions from an existing melody: consecutive notes become
 * scale-degree intervals, and the chain records which interval tends to follow
 * which. Returns null when there is too little material to be meaningful.
 */
export function learnMelodyTable(notes: number[], scaleNotes: number[]): MarkovTable | null {
  const played = notes.filter((n) => n > 0);
  if (played.length < 4 || scaleNotes.length === 0) return null;

  const intervals: number[] = [];
  for (let i = 1; i < played.length; i++) {
    const from = nearestIndex(scaleNotes, played[i - 1]);
    const to = nearestIndex(scaleNotes, played[i]);
    intervals.push(to - from);
  }
  if (intervals.length < 3) return null;

  return learnTransitions(intervals);
}

export function generateMarkovMelody(
  key: NoteName,
  scale: ScaleName,
  density: number,
  progression: ChordProgression,
  vibe: VibeName,
  learnedTable?: MarkovTable | null,
): ChannelData {
  const length = progression.chordAtRow.length;
  const scaleNotes = getScaleNotes(key, scale, 4, 5).map((n) => n.note);
  if (scaleNotes.length === 0) return [0, 0, ...Array(length).fill(0)];

  const style: MelodicStyle = melodicStyleFor(vibe);
  // A learned chain replaces the style's interval priors; its marginal
  // distribution covers intervals the walk hasn't seen before.
  const learnedFallback = learnedTable ? marginalDistribution(learnedTable) : null;

  // When imitating an existing melody, snap to chord tones only rarely: the
  // source's own relationship to the harmony is already encoded in its
  // intervals, and frequent snapping would punch holes in the character we
  // are trying to reproduce.
  const chordSnap = learnedTable ? style.chordSnap * 0.15 : style.chordSnap;

  const rhythmA = pickRhythm(density);
  const rhythmB = pickRhythm(density);

  const notes: number[] = Array(length).fill(0);
  const perChord = rowsPerChord(length);

  // Start on the opening chord's root, mid-range
  let index = nearestIndex(scaleNotes, progression.chordAtRow[0].rootMelody);
  let lastInterval = 0;

  for (let row = 0; row < length; row++) {
    const rhythm = Math.floor(row / perChord) % 2 === 0 ? rhythmA : rhythmB;
    if (!rhythm[row % ROWS_PER_CHORD]) continue;

    // Draw the next interval from the learned chain or the style prior
    let interval: number;
    if (learnedTable) {
      const row_ = learnedTable.get(lastInterval);
      interval = row_ && row_.size > 0
        ? pickWeighted(row_, 0)
        : pickWeighted(learnedFallback!, 0);
    } else {
      interval = pickWeighted(style.intervals, 0);
    }

    // Gap fill: after a leap, usually move back the other way by a step
    if (Math.abs(lastInterval) >= 3 && Math.random() < style.leapRecovery) {
      interval = -Math.sign(lastInterval) * (1 + Math.floor(Math.random() * 2));
    }

    index += interval;
    // Reflect off the edges of the range instead of clamping flat against them
    if (index < 0) index = Math.min(scaleNotes.length - 1, -index);
    if (index >= scaleNotes.length) index = Math.max(0, 2 * (scaleNotes.length - 1) - index);

    // Land on a chord tone at the start of a block so the harmony reads clearly
    const onDownbeat = row % ROWS_PER_CHORD === 0;
    if (onDownbeat && Math.random() < chordSnap) {
      // Move to the CLOSEST chord tone rather than a random one — voice
      // leading. A random pick can hurl the line an octave and a half and
      // wreck whatever contour the chain just built.
      const chord = progression.chordAtRow[row];
      const current = scaleNotes[index];
      let best = index;
      let bestDist = Infinity;
      for (const tone of [chord.rootMelody, chord.thirdMelody, chord.fifthMelody]) {
        const candidate = nearestIndex(scaleNotes, tone);
        const dist = Math.abs(scaleNotes[candidate] - current);
        if (dist < bestDist) {
          bestDist = dist;
          best = candidate;
        }
      }
      index = best;
    }

    notes[row] = scaleNotes[index];
    lastInterval = interval;
  }

  return [0, 0, ...notes];
}
