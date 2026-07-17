// Persistence: auto-save of the working song, named projects in
// localStorage, and .polygen JSON file export/import.
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

export function loadCurrent(): Song | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isSong(parsed) ? parsed : null;
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
    return parsed.filter((p) => p && typeof p.id === 'string' && isSong(p.song));
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
  return candidate;
}
