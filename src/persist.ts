// Persistence: auto-save of the working song, named projects in
// localStorage, and .polygen JSON file export/import.
import {
  CHANNEL_COUNT,
  CH_ARP,
  CH_HAT,
  CH_KICK,
  CH_PAD,
  CH_SNARE,
  DRUM_HIT_NOTE,
  DRUM_NOTES,
} from './engine';
import type { Song } from './engine';

const CURRENT_KEY = 'polygen:current';
const PROJECTS_KEY = 'polygen:projects';
const FILE_VERSION = 1;

export interface SavedProject {
  id: string;
  name: string;
  savedAt: number;
  song: Song;
}

function isSong(value: unknown): value is Song {
  const s = value as Song;
  return (
    !!s &&
    typeof s === 'object' &&
    !!s.config &&
    typeof s.config.bpm === 'number' &&
    !!s.patterns &&
    Array.isArray(s.patternOrder) &&
    Array.isArray(s.sequence) &&
    Array.isArray(s.instruments)
  );
}

const LEGACY_ROWS = 32; // songs from before variable pattern length

/**
 * Songs saved before the 8-channel split have 4 channels
 * ([lead, harmony, bass, drums]). Expand them in place: the merged drum
 * channel fans out to kick/snare/hat by its note encoding, and the new
 * ARP/PAD channels start empty so nothing appears out of nowhere.
 */
export function migrateSong(song: Song): Song {
  const firstPattern = song.patterns[song.patternOrder[0]];
  if (!firstPattern || firstPattern.length >= CHANNEL_COUNT) return song;

  const rows = Math.max(1, (firstPattern[0]?.length ?? LEGACY_ROWS + 2) - 2);
  const silent = (ch: number) => [ch, 0, ...Array(rows).fill(0)];

  const patterns: Song['patterns'] = { ...song.patterns };
  const patternEffects: Song['patternEffects'] = { ...song.patternEffects };

  for (const label of song.patternOrder) {
    const old = song.patterns[label];
    if (!old || old.length >= CHANNEL_COUNT) continue;

    const oldDrums = old[3] ?? silent(3);
    const kick = silent(CH_KICK);
    const snare = silent(CH_SNARE);
    const hat = silent(CH_HAT);
    for (let row = 0; row < rows; row++) {
      const note = oldDrums[row + 2] ?? 0;
      if (note <= 0) continue;
      const target = note <= 6 ? kick : note <= DRUM_NOTES.SNARE + 8 ? snare : hat;
      target[row + 2] = DRUM_HIT_NOTE;
    }

    patterns[label] = [old[0], old[1], old[2], kick, snare, hat, silent(CH_ARP), silent(CH_PAD)];

    const oldFx = song.patternEffects?.[label];
    if (oldFx) {
      const empty = () => Array(rows).fill(null);
      patternEffects[label] = [
        oldFx[0] ?? empty(),
        oldFx[1] ?? empty(),
        oldFx[2] ?? empty(),
        oldFx[3] ?? empty(), // kick keeps the old drum effects
        empty(),
        empty(),
        empty(),
        empty(),
      ];
    }
  }

  // Instruments: reuse the old drum sound for all three drum channels and
  // the harmony sound for arp/pad, so a migrated song still plays.
  const instruments = [...song.instruments];
  while (instruments.length < CHANNEL_COUNT) {
    const source = instruments.length <= CH_HAT ? instruments[3] : instruments[1];
    instruments.push([...(source ?? instruments[0])]);
  }

  const padArray = <T,>(arr: T[] | undefined): (T | null)[] => {
    const out: (T | null)[] = [...(arr ?? [])];
    while (out.length < CHANNEL_COUNT) out.push(null);
    return out;
  };

  return {
    ...song,
    patterns,
    patternEffects,
    instruments,
    channelVibes: padArray(song.channelVibes) as Song['channelVibes'],
    channelAlgos: padArray(song.channelAlgos) as Song['channelAlgos'],
    channelSounds: padArray(song.channelSounds) as Song['channelSounds'],
  };
}

export function loadCurrent(): Song | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isSong(parsed) ? migrateSong(parsed) : null;
  } catch {
    return null;
  }
}

export function saveCurrent(song: Song): void {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(song));
  } catch {
    // Storage full or unavailable — losing autosave is not fatal.
  }
}

export function listProjects(): SavedProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && typeof p.id === 'string' && isSong(p.song))
      .map((p) => ({ ...p, song: migrateSong(p.song) }));
  } catch {
    return [];
  }
}

function writeProjects(projects: SavedProject[]): void {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch {
    // ignore
  }
}

/** Upsert by song name; returns the updated list. */
export function saveProject(song: Song): SavedProject[] {
  const projects = listProjects();
  const name = song.config.name || 'UNTITLED';
  const existing = projects.find((p) => p.name === name);
  if (existing) {
    existing.song = song;
    existing.savedAt = Date.now();
  } else {
    projects.push({
      id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
      name,
      savedAt: Date.now(),
      song,
    });
  }
  projects.sort((a, b) => b.savedAt - a.savedAt);
  writeProjects(projects);
  return projects;
}

export function deleteProject(id: string): SavedProject[] {
  const projects = listProjects().filter((p) => p.id !== id);
  writeProjects(projects);
  return projects;
}

// --- .polygen JSON file ------------------------------------------------------

export function songToFile(song: Song): Blob {
  const payload = { app: 'polygen-tracker', version: FILE_VERSION, song };
  return new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
}

export function songFromFileText(text: string): Song {
  const parsed = JSON.parse(text);
  const candidate = parsed?.song ?? parsed; // accept bare Song JSON too
  if (!isSong(candidate)) throw new Error('Not a polygen song file');
  return migrateSong(candidate);
}
