// Read a whole Polyend project back into a Song.
//
// The app could already parse a single .mtp; this reads an exported project
// folder (or zip) — project.mt, the pattern files and their metadata — so
// device work can come back in, be transformed, and go out again.
//
// What round-trips and what cannot:
//   notes, per-step FX, pattern roles, the playlist and the tempo  -> yes
//   instrument timbres                                            -> no
//
// The second is a hard limit, not an omission. A .pti holds a rendered sample;
// the app's instruments are ZzFX parameter arrays, and there is no inverse
// from audio back to synthesis parameters. Imported songs therefore keep
// generated instruments, and the importer says so rather than pretending.
import JSZip from 'jszip';
import {
  CHANNEL_COUNT,
  DEFAULT_PATTERN_LENGTH,
  DRUM_HIT_NOTE,
  PATTERN_LENGTHS,
  isDrumChannel,
} from '../engine/types';
import type { EffectCode, PatternEffects, PatternLabel, Song, SectionRole } from '../engine/types';
import { generateSong } from '../engine/song';
import { EFFECT_MAP } from '../export/fxMap';
import { Metadata, Pattern, Project } from '../lib/polyend';

/** Inverse of the exporter's zzfxm -> Polyend note mapping. */
const ZZFXM_TO_POLYEND = 36;

const PATTERN_LABELS: PatternLabel[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export interface ImportResult {
  song: Song;
  /** Things the user should know were approximated or dropped. */
  notes: string[];
}

/** Polyend FX index -> the generator's code, derived from the export mapping. */
function buildReverseFxMap(): Map<string, EffectCode> {
  const reverse = new Map<string, EffectCode>();
  for (const [code, mapping] of Object.entries(EFFECT_MAP) as [EffectCode, { polyend: string | null }][]) {
    // Several codes can target one FX; first one wins, which is fine because
    // the mapping is only used to show something meaningful in the FX lane.
    if (mapping.polyend && !reverse.has(mapping.polyend)) reverse.set(mapping.polyend, code);
  }
  return reverse;
}

const REVERSE_FX = buildReverseFxMap();

function roleFromName(name: string): SectionRole {
  const lower = name.toLowerCase();
  for (const role of ['breakdown', 'contrast', 'refrain', 'chorus', 'bridge', 'climax', 'verse'] as SectionRole[]) {
    if (lower.includes(role)) return role;
  }
  return 'verse';
}

/**
 * Infer a pattern's musical length.
 *
 * A .mtp always stores 128 steps (PatternConstants.STEP_COUNT) and tracker-lib
 * exposes no field for how many of them the pattern actually uses, so the
 * length cannot be read — only inferred from where the content stops. Take the
 * last step carrying a note and round up to the nearest length the app
 * supports. A pattern with a deliberately empty tail therefore imports shorter
 * than it was written; that is a limit of what the file tells us.
 */
function inferLength(tracks: { steps: { note: number }[] }[], supported: number[]): number {
  let last = -1;
  for (const track of tracks) {
    for (let i = track.steps.length - 1; i > last; i--) {
      if (track.steps[i].note > 0) {
        last = i;
        break;
      }
    }
  }
  if (last < 0) return supported[0];
  return supported.find((length) => length > last) ?? supported[supported.length - 1];
}

/** Sorted pattern files, tolerating both `patterns/x.mtp` and a flat zip. */
function patternFiles(zip: JSZip): string[] {
  return Object.keys(zip.files)
    .filter((name) => name.toLowerCase().endsWith('.mtp'))
    .sort();
}

export async function importProjectZip(data: ArrayBuffer | Blob): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(data);
  const notes: string[] = [];

  const files = patternFiles(zip);
  if (files.length === 0) throw new Error('No .mtp pattern files found in this project');

  // --- Project file: tempo and playlist -------------------------------
  let bpm = 120;
  let playlist: number[] = [];
  const projectFile = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith('project.mt'));
  if (projectFile) {
    try {
      const project = Project.parse(await zip.file(projectFile)!.async('arraybuffer'));
      bpm = project.values.globalTempo || bpm;
      // Playlist entries are 1-based, 0 meaning empty.
      playlist = (project.song.playlist ?? []).filter((slot: number) => slot > 0).map((slot: number) => slot - 1);
    } catch {
      notes.push('project.mt could not be read — tempo and playlist fell back to defaults.');
    }
  } else {
    notes.push('No project.mt found, so this imported as patterns only.');
  }

  // --- Pattern names, for section roles -------------------------------
  let names: string[] = [];
  const metaFile = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith('patternsmetadata'));
  if (metaFile) {
    try {
      const meta = Metadata.parsePatternsMetadata(await zip.file(metaFile)!.async('arraybuffer'));
      names = (meta?.patternNames ?? []) as string[];
    } catch {
      // Names are cosmetic; losing them costs only the role labels.
    }
  }

  // --- Patterns --------------------------------------------------------
  const usable = files.slice(0, PATTERN_LABELS.length);
  if (files.length > PATTERN_LABELS.length) {
    notes.push(
      `This project has ${files.length} patterns; the app holds ${PATTERN_LABELS.length}, so the extra ones were dropped.`
    );
  }

  const patterns: Song['patterns'] = {} as Song['patterns'];
  const patternEffects: Song['patternEffects'] = {} as Song['patternEffects'];
  const patternRoles: Song['patternRoles'] = {} as Song['patternRoles'];
  const patternOrder: PatternLabel[] = [];

  let rows = DEFAULT_PATTERN_LENGTH as number;
  let sawExtraTracks = false;
  let droppedFx = false;

  for (let i = 0; i < usable.length; i++) {
    const label = PATTERN_LABELS[i];
    const parsed = Pattern.parse(await zip.file(usable[i])!.async('arraybuffer'));
    const trackCount = parsed.tracks.length;
    // The first pattern sets the song's length; the app holds one length for
    // all patterns, so later ones are read to the same number of rows.
    if (i === 0) rows = inferLength(parsed.tracks, PATTERN_LENGTHS as unknown as number[]);
    const stepCount = rows;

    if (trackCount > CHANNEL_COUNT && parsed.tracks.slice(CHANNEL_COUNT).some(
      (t: { steps: { note: number }[] }) => t.steps.some((s) => s.note > 0)
    )) {
      sawExtraTracks = true;
    }

    const channels: number[][] = [];
    const effects: PatternEffects = [];

    for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
      const track = parsed.tracks[ch];
      const channel: number[] = [ch, 0];
      const channelFx: (null | { code: EffectCode; value: number })[] = [];

      for (let row = 0; row < stepCount; row++) {
        const step = track?.steps[row];
        const note = step?.note ?? 0;
        // Drums are one-shots on the device; the app stores a fixed hit note.
        channel.push(note > 0 ? (isDrumChannel(ch) ? DRUM_HIT_NOTE : Math.max(1, note - ZZFXM_TO_POLYEND)) : 0);

        let mapped: { code: EffectCode; value: number } | null = null;
        for (const fx of step?.fx ?? []) {
          const code = fx?.type?.name ? REVERSE_FX.get(fx.type.name) : undefined;
          if (code) {
            mapped = { code, value: fx.value };
            break;
          }
          if (fx?.type?.name && fx.type.name !== 'None') droppedFx = true;
        }
        channelFx.push(mapped);
      }

      channels.push(channel);
      effects.push(channelFx);
    }

    patterns[label] = channels;
    patternEffects[label] = effects;
    patternRoles[label] = roleFromName(names[i] ?? '');
    patternOrder.push(label);
  }

  if (sawExtraTracks) {
    notes.push('Tracks 9+ carried notes; the app has 8 channels, so those parts were not imported.');
  }
  if (droppedFx) {
    notes.push('Some step FX have no equivalent in the app and were dropped from the display.');
  }
  notes.push('Instrument sounds could not be imported — a .pti is a rendered sample, so generated timbres were used instead.');
  notes.push(
    `Pattern files always store 128 steps and do not record how many are in use, so the length was inferred from the last note and read as ${rows} rows.`
  );

  // --- Assemble --------------------------------------------------------
  // Start from a generated song so every field the app expects is present and
  // valid, then overwrite what the file actually determines.
  const base = generateSong({ bpm, patternLength: rows as Song['config']['patternLength'] });

  const sequence = playlist.filter((idx) => idx < patternOrder.length);

  return {
    song: {
      ...base,
      config: { ...base.config, bpm, patternLength: rows as Song['config']['patternLength'] },
      patterns,
      patternEffects,
      patternRoles,
      patternOrder,
      sequence: sequence.length ? sequence : patternOrder.map((_, i) => i),
      // These describe how a song was generated; an imported one was not.
      channelSeeds: undefined,
      patternChords: undefined,
    },
    notes,
  };
}
