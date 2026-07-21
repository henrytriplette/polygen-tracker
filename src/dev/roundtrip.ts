// Dev-only self-test: builds a Polyend project zip from a freshly generated
// song, then re-parses every file with @polyend/tracker-lib's public readers
// and cross-checks the data. Run from the browser console:
//   (await import('/src/dev/roundtrip.ts')).runRoundtrip()
import JSZip from 'jszip';
import { CHANNEL_COUNT, generateSong, isDrumChannel } from '../engine';
import type { Song } from '../engine';
import { buildPatternsZip, buildPolyendProjectZip } from '../export/polyend';
import { Tracker } from '../lib/polyend';

async function asFile(zip: JSZip, path: string): Promise<File | null> {
  const entry = zip.file(path);
  if (!entry) return null;
  return new File([await entry.async('arraybuffer')], path.split('/').pop()!);
}

interface Report {
  ok: boolean;
  errors: string[];
  info: Record<string, unknown>;
}

const ZZFXM_TO_POLYEND = 36;

export async function runRoundtrip(existingSong?: Song, trackCount: 8 | 12 | 16 = 12): Promise<Report> {
  const errors: string[] = [];
  const info: Record<string, unknown> = {};
  const song = existingSong ?? generateSong();

  const blob = await buildPolyendProjectZip(song, { trackCount });
  info.trackCount = trackCount;
  info.zipBytes = blob.size;

  const zip = await new JSZip().loadAsync(await blob.arrayBuffer());
  const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir).sort();
  info.paths = paths;

  // --- project.mt ---
  const projectFile = await asFile(zip, 'project.mt');
  const project = projectFile ? await Tracker.readProject(projectFile) : null;
  if (!project) {
    errors.push('project.mt missing or unparseable');
  } else {
    info.projectName = project.projectName;
    info.globalTempo = project.values.globalTempo;
    if (project.values.globalTempo !== song.config.bpm) {
      errors.push(`tempo mismatch: ${project.values.globalTempo} != ${song.config.bpm}`);
    }
    const expectedPlaylist = song.sequence.map((i) => i + 1);
    const actualPlaylist = project.song.playlist.slice(0, song.sequence.length);
    if (JSON.stringify(actualPlaylist) !== JSON.stringify(expectedPlaylist)) {
      errors.push(`playlist mismatch: ${actualPlaylist} != ${expectedPlaylist}`);
    }
    if (project.song.playlist[song.sequence.length] !== 0) {
      errors.push('playlist not zero-terminated after sequence');
    }
  }

  // --- patternsMetadata ---
  const metaFile = await asFile(zip, 'patterns/patternsMetadata');
  const meta = metaFile ? await Tracker.readPatternsMetadata(metaFile) : null;
  if (!meta) {
    errors.push('patterns/patternsMetadata missing or unparseable');
  } else {
    info.patternNames = meta.patternNames;
    if (meta.patternNames.length !== song.patternOrder.length) {
      errors.push(`pattern name count ${meta.patternNames.length} != ${song.patternOrder.length}`);
    }
  }

  // --- patterns ---
  let checkedNotes = 0;
  for (let p = 0; p < song.patternOrder.length; p++) {
    const name = `patterns/pattern_${String(p + 1).padStart(2, '0')}.mtp`;
    const file = await asFile(zip, name);
    const parsed = file ? await Tracker.readPattern(file) : null;
    if (!parsed) {
      errors.push(`${name} missing or unparseable`);
      continue;
    }
    if (parsed.trackCount !== trackCount) {
      errors.push(`${name}: trackCount ${parsed.trackCount} != ${trackCount}`);
    }

    const label = song.patternOrder[p];
    const source = song.patterns[label];
    const rows = Math.max(0, (source[0]?.length ?? 2) - 2);
    // Channels map 1:1 onto tracks and instrument slots.
    for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
      for (let row = 0; row < rows; row++) {
        const srcNote = source[ch][row + 2];
        const step = parsed.tracks[ch].steps[row];
        if (srcNote <= 0) {
          if (step.note !== -1) errors.push(`${name} ch${ch} row${row}: expected empty, got ${step.note}`);
          continue;
        }
        checkedNotes++;
        const expectedNote = isDrumChannel(ch) ? 48 : srcNote + ZZFXM_TO_POLYEND;
        if (step.note !== expectedNote) {
          errors.push(`${name} ch${ch} row${row}: note ${step.note} != ${expectedNote}`);
        }
        if (step.instrument !== ch) {
          errors.push(`${name} ch${ch} row${row}: instrument ${step.instrument} != ${ch}`);
        }
      }
    }
  }
  info.checkedNotes = checkedNotes;

  // --- instruments ---
  const instrumentPaths = paths.filter((p) => p.startsWith('instruments/'));
  if (instrumentPaths.length !== CHANNEL_COUNT) errors.push(`expected ${CHANNEL_COUNT} instruments, got ${instrumentPaths.length}`);
  const sampleLengths: Record<string, number> = {};
  for (const path of instrumentPaths) {
    const file = await asFile(zip, path);
    const parsed = file ? await Tracker.readInstrument(file) : null;
    sampleLengths[path] = parsed?.sample.length ?? -1;
    if (!parsed || parsed.sample.length <= 0) errors.push(`${path}: empty or unparseable sample`);
  }
  info.sampleLengths = sampleLengths;

  return { ok: errors.length === 0, errors: errors.slice(0, 20), info };
}

/** Verify the patterns-only export: every .mtp parses and matches the song. */
export async function runPatternsRoundtrip(existingSong?: Song, trackCount: 8 | 12 | 16 = 12): Promise<Report> {
  const errors: string[] = [];
  const info: Record<string, unknown> = {};
  const song = existingSong ?? generateSong();

  const blob = await buildPatternsZip(song, { trackCount });
  info.zipBytes = blob.size;
  const zip = await new JSZip().loadAsync(await blob.arrayBuffer());
  const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir).sort();
  info.paths = paths;

  // Count pattern files specifically: the zip also carries the README.
  const mtpPaths = paths.filter((p) => p.toLowerCase().endsWith('.mtp'));
  if (mtpPaths.length !== song.patternOrder.length) {
    errors.push(`expected ${song.patternOrder.length} .mtp files, got ${mtpPaths.length}`);
  }
  if (paths.some((p) => p.includes('/'))) {
    errors.push('patterns zip should be flat (no folders)');
  }

  for (let p = 0; p < song.patternOrder.length; p++) {
    const name = `pattern_${String(p + 1).padStart(2, '0')}.mtp`;
    const file = await asFile(zip, name);
    const parsed = file ? await Tracker.readPattern(file) : null;
    if (!parsed) {
      errors.push(`${name} missing or unparseable`);
      continue;
    }
    if (parsed.trackCount !== trackCount) errors.push(`${name}: trackCount ${parsed.trackCount} != ${trackCount}`);
    const source = song.patterns[song.patternOrder[p]];
    const rows = Math.max(0, (source[0]?.length ?? 2) - 2);
    for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
      for (let row = 0; row < rows; row++) {
        const srcNote = source[ch][row + 2];
        const step = parsed.tracks[ch].steps[row];
        if (srcNote <= 0 && step.note !== -1) errors.push(`${name} ch${ch} row${row}: expected empty`);
        if (srcNote > 0 && step.note === -1) errors.push(`${name} ch${ch} row${row}: expected note`);
      }
    }
  }

  return { ok: errors.length === 0, errors: errors.slice(0, 20), info };
}
