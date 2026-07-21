// Fragment bank: many short candidate ideas for one channel.
//
// Generating a whole song to keep one bar of it is a bad trade — you audition
// four minutes to find four seconds. This generates the four seconds directly:
// a batch of one-bar ideas for a single channel, each with its own seed, to be
// auditioned quickly and mostly thrown away.
//
// Fragments are generated against the *current* pattern, so they inherit its
// chord progression, key, vibe and per-channel algorithm. They are candidates
// for this song, not generic material.
import { CHANNEL_COUNT, PatternLabel, Song } from './types';
import type { NoteEffect } from './types';
import { randomSeed, withSeed } from './random';
import { regenerateChannel } from './song';
import { CHANNEL_ALGO_IDS } from './altPatterns';

/** One bar of sixteenths. The unit an idea actually arrives in. */
export const FRAGMENT_ROWS = 16;

export const DEFAULT_FRAGMENT_COUNT = 16;

export interface Fragment {
  id: string;
  seed: number;
  channel: number;
  /** Algorithm that produced it, so a good candidate can be traced back. */
  algo: string | null;
  /** FRAGMENT_ROWS note values; 0 is a rest. */
  rows: number[];
  effects: (NoteEffect | null)[];
  starred: boolean;
}

/** Notes only, as a comparable key — used to reject duplicate candidates. */
function shapeKey(rows: number[]): string {
  return rows.join(',');
}

function isSilent(rows: number[]): boolean {
  return rows.every((note) => !note || note <= 0);
}

/**
 * A one-bar copy of the song, used as the context a fragment is generated
 * against. Truncating rather than regenerating keeps the pattern's stored
 * chord progression, so candidates stay harmonically aligned with the song.
 */
function oneBarContext(song: Song, label: PatternLabel): Song {
  const source = song.patterns[label] ?? [];
  const patterns = {
    [label]: source.map((channel, ch) => {
      const out = [channel[0] ?? ch, channel[1] ?? 0];
      for (let row = 0; row < FRAGMENT_ROWS; row++) out.push(channel[row + 2] ?? 0);
      return out;
    }),
  } as Song['patterns'];

  const sourceEffects = song.patternEffects?.[label] ?? [];
  const patternEffects = {
    [label]: Array.from({ length: CHANNEL_COUNT }, (_, ch) =>
      Array.from({ length: FRAGMENT_ROWS }, (_, row) => sourceEffects[ch]?.[row] ?? null)
    ),
  } as Song['patternEffects'];

  return {
    ...song,
    config: { ...song.config, patternLength: FRAGMENT_ROWS },
    patterns,
    patternEffects,
    patternOrder: [label],
    sequence: [0],
  };
}

/**
 * A batch of candidate one-bar ideas for one channel.
 *
 * Candidates span the channel's *algorithms*, not just seeds. Reseeding alone
 * is not enough: a four-on-the-floor kick is the same bar at every seed, so a
 * seed-only batch collapsed to a single candidate for the drum and pad
 * channels. Cycling the algorithm is what makes sixteen ideas actually
 * sixteen ideas.
 *
 * Duplicates and silent results are rejected and retried — sixteen identical
 * candidates waste exactly the attention this feature exists to save. The
 * retry budget is bounded, because some contexts genuinely cannot produce
 * `count` distinct bars and returning fewer beats spinning.
 *
 * Expect fewer than `count` on sustained channels: over a single bar with the
 * chord fixed, a pad has about as many distinct behaviours as it has
 * algorithms. Returning three honest candidates is better than padding the
 * batch with near-duplicates.
 */
export function generateFragments(
  song: Song,
  label: PatternLabel,
  channel: number,
  count = DEFAULT_FRAGMENT_COUNT
): Fragment[] {
  const context = oneBarContext(song, label);
  const algos = CHANNEL_ALGO_IDS[channel] ?? [];
  const fragments: Fragment[] = [];
  const seen = new Set<string>();

  const maxAttempts = count * 6;
  for (let attempt = 0; attempt < maxAttempts && fragments.length < count; attempt++) {
    const seed = randomSeed();

    // Rotate through the algorithms so a batch covers the channel's whole
    // vocabulary before it starts repeating one.
    const algoContext = algos.length
      ? {
          ...context,
          channelAlgos: Object.assign([...(context.channelAlgos ?? [])], {
            [channel]: algos[attempt % algos.length],
          }) as Song['channelAlgos'],
        }
      : context;

    const { pattern, effects } = withSeed(seed, () =>
      regenerateChannel(algoContext, label, channel, { forceAudible: true })
    );

    const rows = (pattern[channel] ?? []).slice(2, FRAGMENT_ROWS + 2);
    if (rows.length === 0 || isSilent(rows)) continue;

    const key = shapeKey(rows);
    if (seen.has(key)) continue;
    seen.add(key);

    fragments.push({
      id: `${seed.toString(36)}-${fragments.length}`,
      seed,
      channel,
      algo: algos.length ? algos[attempt % algos.length] : null,
      rows,
      effects: (effects[channel] ?? []).slice(0, FRAGMENT_ROWS),
      starred: false,
    });
  }

  return fragments;
}

/**
 * A minimal song that plays one fragment alone, for auditioning.
 * Every other channel is silenced so you hear the candidate, not the mix.
 */
export function fragmentPreviewSong(song: Song, fragment: Fragment): Song {
  const label = song.patternOrder[0];
  const silent = (ch: number) => [ch, 0, ...Array(FRAGMENT_ROWS).fill(0)];

  const pattern = Array.from({ length: CHANNEL_COUNT }, (_, ch) =>
    ch === fragment.channel ? [ch, 0, ...fragment.rows] : silent(ch)
  );

  const effects = Array.from({ length: CHANNEL_COUNT }, (_, ch) =>
    ch === fragment.channel
      ? Array.from({ length: FRAGMENT_ROWS }, (_, row) => fragment.effects[row] ?? null)
      : Array(FRAGMENT_ROWS).fill(null)
  );

  return {
    ...song,
    config: { ...song.config, patternLength: FRAGMENT_ROWS },
    patterns: { [label]: pattern } as Song['patterns'],
    patternEffects: { [label]: effects } as Song['patternEffects'],
    patternOrder: [label],
    sequence: [0],
  };
}

/**
 * Write a fragment into a pattern, tiling it across the full length.
 *
 * A one-bar idea dropped into a four-bar pattern should repeat rather than
 * leave three bars empty — the same "content repeats at its natural period"
 * rule the generators already follow.
 */
export function applyFragment(
  song: Song,
  label: PatternLabel,
  fragment: Fragment
): { pattern: Song['patterns'][PatternLabel]; effects: Song['patternEffects'][PatternLabel] } {
  const source = song.patterns[label];
  const rows = Math.max(0, (source[0]?.length ?? 2) - 2);

  const pattern = source.map((channel) => [...channel]);
  const effects = (song.patternEffects?.[label] ?? []).map((channel) => [...(channel ?? [])]);

  const target = pattern[fragment.channel];
  if (!target) return { pattern, effects };

  for (let row = 0; row < rows; row++) {
    const value = fragment.rows[row % FRAGMENT_ROWS] ?? 0;
    target[row + 2] = value;
    if (effects[fragment.channel]) {
      effects[fragment.channel][row] = fragment.effects[row % FRAGMENT_ROWS] ?? null;
    }
  }

  return { pattern, effects };
}
