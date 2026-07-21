// Export a palette project: one .mt where each pattern is a candidate idea
// rather than a section of a song.
//
// The point is where the auditioning happens. This user makes decisions on the
// hardware, through their own speakers, in their own room — not in a browser
// tab. A palette project puts the shelf of candidates on the device, one idea
// per pattern, so they can be flicked through in the place where they will
// actually be judged.
//
// The song's other channels are kept underneath each candidate, so an idea is
// heard in context rather than naked. That is the difference between "is this
// interesting" and "does this work here", and only the second is useful.
import { CHANNEL_COUNT, FRAGMENT_ROWS } from '../engine';
import type { Fragment, PatternLabel, Song } from '../engine';
import { buildPolyendProjectZip, type PolyendExportOptions } from './polyend';

/** Pattern slots available in a song, in order. */
const LABELS: PatternLabel[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export interface PaletteOptions extends PolyendExportOptions {
  /** Play each candidate over the rest of the current pattern. Default true. */
  withBacking?: boolean;
}

/**
 * Build a song whose patterns are candidates rather than sections.
 *
 * Each fragment is tiled across a pattern of the song's normal length, so a
 * one-bar idea repeats rather than playing once into silence. The playlist
 * walks the candidates in order.
 */
export function buildPaletteSong(
  song: Song,
  fragments: Fragment[],
  options: PaletteOptions = {}
): Song {
  const withBacking = options.withBacking ?? true;
  const usable = fragments.slice(0, LABELS.length);
  if (usable.length === 0) throw new Error('No fragments to export');

  const sourceLabel = song.patternOrder[0];
  const source = song.patterns[sourceLabel];
  const rows = Math.max(FRAGMENT_ROWS, (source?.[0]?.length ?? 2) - 2);
  const sourceEffects = song.patternEffects?.[sourceLabel] ?? [];

  const patterns = {} as Song['patterns'];
  const patternEffects = {} as Song['patternEffects'];
  const patternRoles = {} as Song['patternRoles'];
  const patternOrder: PatternLabel[] = [];

  usable.forEach((fragment, index) => {
    const label = LABELS[index];

    const pattern = Array.from({ length: CHANNEL_COUNT }, (_, ch) => {
      const channel: number[] = [ch, 0];
      for (let row = 0; row < rows; row++) {
        if (ch === fragment.channel) {
          channel.push(fragment.rows[row % FRAGMENT_ROWS] ?? 0);
        } else {
          channel.push(withBacking ? source?.[ch]?.[row + 2] ?? 0 : 0);
        }
      }
      return channel;
    });

    const effects = Array.from({ length: CHANNEL_COUNT }, (_, ch) =>
      Array.from({ length: rows }, (_, row) =>
        ch === fragment.channel
          ? fragment.effects[row % FRAGMENT_ROWS] ?? null
          : (withBacking ? sourceEffects[ch]?.[row] ?? null : null)
      )
    );

    patterns[label] = pattern;
    patternEffects[label] = effects;
    patternRoles[label] = 'verse';
    patternOrder.push(label);
  });

  return {
    ...song,
    config: {
      ...song.config,
      // Named so it is obvious on the device that this is a shelf of ideas,
      // not a track — these projects sit next to real ones on the SD card.
      name: `${song.config.name} IDEAS`.substring(0, 32),
    },
    patterns,
    patternEffects,
    patternRoles,
    patternOrder,
    sequence: patternOrder.map((_, index) => index),
    patternChords: undefined,
  };
}

export async function buildPaletteZip(
  song: Song,
  fragments: Fragment[],
  options: PaletteOptions = {}
): Promise<Blob> {
  return buildPolyendProjectZip(buildPaletteSong(song, fragments, options), options);
}
