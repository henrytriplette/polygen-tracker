import { reactive, computed, watch } from 'vue';
import JSZip from 'jszip';
import {
  AudioGraph,
  CHORDS_PER_PATTERN,
  ZZFX,
  addPatternToSong,
  applyChannelAlgo,
  applyChannelVibe,
  applyChannelSound,
  applyChordsToPattern,
  applySongStructure,
  floatsToWav,
  generateSong,
  getRandomBpm,
  mutatePattern,
  randomProgressionDegrees,
  randomSeed,
  regenerateAllPatterns,
  regenerateChannel,
  regenerateForVibe,
  regeneratePattern,
  regenerateChannelInAllPatterns,
  regenerateWithNewLength,
  renderSongBuffers,
  snapNoteToScale,
  withSeed,
  zzfxP,
} from './engine';
import type { ChannelAlgos, NoteEffect, Pattern, PatternEffects } from './engine';
import type { NoteName, PatternLabel, ScaleName, Song, SongLength, VibeName } from './engine';

// Selectable timbre palette per channel (re-exported from the engine so the
// grid can render it next to the vibe/algo pickers). null = AUTO.
export { CHANNEL_SOUND_OPTIONS } from './engine';

// Selectable pattern algorithms per channel (null = AUTO, the vibe default)
export const CHANNEL_ALGO_OPTIONS: { value: string; label: string }[][] = [
  [
    { value: 'walk', label: 'WALK' },
    { value: 'arp', label: 'ARP' },
    { value: 'riff', label: 'RIFF' },
  ],
  [
    { value: 'gapfill', label: 'GAPFILL' },
    { value: 'stabs', label: 'STABS' },
    { value: 'arp', label: 'ARP' },
    { value: 'pedal', label: 'PEDAL' },
  ],
  [
    { value: 'groove', label: 'GROOVE' },
    { value: 'acid', label: 'ACID' },
    { value: 'arp', label: 'ARP' },
    { value: 'offbeat', label: 'OFFBEAT' },
  ],
  [
    { value: 'template', label: 'TEMPLATE' },
    { value: 'euclid', label: 'EUCLID' },
    { value: 'break', label: 'BREAK' },
    { value: 'four', label: '4-FLOOR' },
  ],
];
import { downloadPolyendPatterns, downloadPolyendProject, sanitizeProjectName } from './export/polyend';
import { buildMidiFile } from './export/midi';
import { songFromHash, songToHash } from './share';
import { Tracker } from './lib/polyend';
import { DRUM_NOTES } from './engine';
import {
  deleteProject,
  listProjects,
  loadCurrent,
  saveCurrent,
  saveProject,
  songFromFileText,
  songToFile,
  type SavedProject,
} from './persist';

export const CHANNEL_LABELS = ['LEAD', 'HARM', 'BASS', 'DRUM'] as const;

export interface VibeOption {
  value: VibeName;
  label: string;
}

export const VIBE_GROUPS: { label: string; vibes: VibeOption[] }[] = [
  {
    label: 'GAME',
    vibes: [
      { value: 'adventure', label: 'ADVENTURE' },
      { value: 'battle', label: 'BATTLE' },
      { value: 'dungeon', label: 'DUNGEON' },
      { value: 'titleScreen', label: 'TITLE' },
      { value: 'boss', label: 'BOSS' },
    ],
  },
  {
    label: 'ELECTRONIC',
    vibes: [
      { value: 'synthwave', label: 'SYNTHWAVE' },
      { value: 'house', label: 'HOUSE' },
      { value: 'techno', label: 'TECHNO' },
      { value: 'dub', label: 'DUB' },
      { value: 'idm', label: 'IDM' },
      { value: 'hardcore', label: 'HARDCORE' },
      { value: 'dnb', label: 'DNB' },
    ],
  },
  {
    label: 'CLASSICS',
    vibes: [
      { value: 'lofi', label: 'LO-FI' },
      { value: 'funk', label: 'FUNK' },
      { value: 'punk', label: 'PUNK' },
    ],
  },
];

export const VIBE_OPTIONS: VibeOption[] = VIBE_GROUPS.flatMap((g) => g.vibes);

export function vibeLabel(vibe: VibeName): string {
  return VIBE_OPTIONS.find((v) => v.value === vibe)?.label ?? vibe.toUpperCase();
}

interface StoreState {
  song: Song;
  selectedPattern: PatternLabel;
  isPlaying: boolean;
  playSeqIdx: number;
  playRow: number;
  muted: boolean[];
  solo: number | null;
  exportDevice: 8 | 12 | 16;
  isExporting: boolean;
  snapToScale: boolean;
  projects: SavedProject[];
  undoCount: number;
  redoCount: number;
  seedInput: string;
  lastSeed: number | null;
  follow: boolean;
  shareStatus: '' | 'copied' | 'failed';
}

const initialSong = loadCurrent() ?? generateSong();

const state = reactive<StoreState>({
  song: initialSong,
  selectedPattern: initialSong.patternOrder[0] ?? 'A',
  isPlaying: false,
  playSeqIdx: 0,
  playRow: -1,
  muted: [false, false, false, false],
  solo: null,
  exportDevice: 12,
  isExporting: false,
  snapToScale: true,
  projects: listProjects(),
  undoCount: 0,
  redoCount: 0,
  seedInput: '',
  lastSeed: null,
  follow: false,
  shareStatus: '',
});

// --- History + autosave ------------------------------------------------------
// Every store action replaces state.song immutably, so a watch on the
// reference gives us both undo history and autosave for free.
const HISTORY_LIMIT = 64;
const undoStack: Song[] = [];
const redoStack: Song[] = [];
let suppressHistory = false;
let saveTimer = 0;

watch(
  () => state.song,
  (_next, prev) => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveCurrent(state.song), 400);

    if (suppressHistory) {
      suppressHistory = false;
      return;
    }
    if (prev) {
      undoStack.push(prev);
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
      redoStack.length = 0;
    }
    state.undoCount = undoStack.length;
    state.redoCount = redoStack.length;
  }
);

let graph: AudioGraph | null = null;
let rafHandle = 0;

function getGraph(): AudioGraph {
  if (!graph) graph = new AudioGraph();
  return graph;
}

function renderBuffers(song: Song): { buffers: [number[], number[]][]; duration: number } {
  const buffers = renderSongBuffers(song);
  const duration = buffers.length ? buffers[0][0].length / ZZFX.sampleRate : 0;
  return { buffers, duration };
}

function applyGains(): void {
  if (!graph) return;
  for (let ch = 0; ch < 4; ch++) {
    const audible = state.solo !== null ? state.solo === ch : !state.muted[ch];
    graph.setChannelGain(ch, audible ? 1 : 0);
  }
}

function tickPlayhead(): void {
  if (!graph || !state.isPlaying) return;
  const pos = graph.getPosition();
  const rowDuration = 60 / graph.bpm / 4;
  // The zzfxm renderer drops the very first beat, so position 0 is row 1.
  const totalRows = state.song.sequence.length * 32 - 1;
  const globalRow = (Math.floor(pos / rowDuration) + 1) % (totalRows + 1);
  state.playSeqIdx = Math.min(Math.floor(globalRow / 32), state.song.sequence.length - 1);
  state.playRow = globalRow % 32;
  if (state.follow) {
    const playing = state.song.patternOrder[state.song.sequence[state.playSeqIdx]];
    if (playing && playing !== state.selectedPattern) state.selectedPattern = playing;
  }
  rafHandle = requestAnimationFrame(tickPlayhead);
}

function restartPlayheadLoop(): void {
  cancelAnimationFrame(rafHandle);
  rafHandle = requestAnimationFrame(tickPlayhead);
}

function swapAudio(): void {
  if (!graph || !state.isPlaying) return;
  const { buffers, duration } = renderBuffers(state.song);
  graph.replaceAllChannels(buffers, duration, state.song.config.bpm);
}

function afterSongChange(): void {
  if (!(state.selectedPattern in state.song.patterns)) {
    state.selectedPattern = state.song.patternOrder[0];
  }
  swapAudio();
}

export const store = {
  state,

  channelColor(ch: number): string {
    return ['var(--ch-lead)', 'var(--ch-harmony)', 'var(--ch-bass)', 'var(--ch-drums)'][ch];
  },

  getAnalyser(): AnalyserNode | null {
    return graph?.getAnalyser() ?? null;
  },

  toggleFollow(): void {
    state.follow = !state.follow;
  },

  playingPattern: computed<PatternLabel | null>(() => {
    if (!state.isPlaying) return null;
    return state.song.patternOrder[state.song.sequence[state.playSeqIdx]] ?? null;
  }),

  play(): void {
    const g = getGraph();
    const { buffers, duration } = renderBuffers(state.song);
    if (!buffers.length) return;
    g.play(buffers, duration, state.song.config.bpm);
    state.isPlaying = true;
    applyGains();
    restartPlayheadLoop();
  },

  stop(): void {
    graph?.stop();
    state.isPlaying = false;
    state.playRow = -1;
    state.playSeqIdx = 0;
    cancelAnimationFrame(rafHandle);
  },

  togglePlay(): void {
    if (state.isPlaying) this.stop();
    else this.play();
  },

  toggleMute(ch: number): void {
    state.muted[ch] = !state.muted[ch];
    applyGains();
  },

  toggleSolo(ch: number): void {
    state.solo = state.solo === ch ? null : ch;
    applyGains();
  },

  newSong(): void {
    // Seeded when the seed field has a value; random (but reported) otherwise
    const parsed = Number.parseInt(state.seedInput.trim(), 10);
    const seed = Number.isFinite(parsed) && state.seedInput.trim() !== '' ? parsed >>> 0 : randomSeed();
    state.lastSeed = seed;
    state.song = withSeed(seed, () =>
      generateSong(
        { vibe: state.song.config.vibe, length: state.song.config.length },
        state.song.channelVibes,
        state.song.channelAlgos,
        state.song.structureId,
        state.song.channelSounds
      )
    );
    state.selectedPattern = state.song.patternOrder[0];
    afterSongChange();
  },

  mutate(): void {
    const label = state.selectedPattern;
    const pattern = mutatePattern(state.song, label);
    state.song = {
      ...state.song,
      patterns: { ...state.song.patterns, [label]: pattern },
    };
    swapAudio();
  },

  setStructure(structureId: string | null): void {
    state.song = applySongStructure(state.song, structureId);
    state.selectedPattern = state.song.patternOrder[0];
    afterSongChange();
  },

  setVibe(vibe: VibeName): void {
    if (vibe === state.song.config.vibe) return;
    state.song = regenerateForVibe(state.song, vibe);
    afterSongChange();
  },

  setKey(key: NoteName): void {
    state.song = regenerateAllPatterns(state.song, { key });
    afterSongChange();
  },

  setScale(scale: ScaleName): void {
    state.song = regenerateAllPatterns(state.song, { scale });
    afterSongChange();
  },

  setLength(length: SongLength): void {
    if (length === state.song.config.length) return;
    state.song = regenerateWithNewLength(state.song, length);
    afterSongChange();
  },

  setBpm(bpm: number): void {
    const clamped = Math.max(40, Math.min(220, Math.round(bpm)));
    state.song = { ...state.song, config: { ...state.song.config, bpm: clamped } };
    swapAudio();
  },

  rollBpm(): void {
    this.setBpm(getRandomBpm(state.song.config.vibe));
  },

  setSwing(percent: number): void {
    const swing = Math.max(0, Math.min(30, Math.round(percent)));
    state.song = { ...state.song, config: { ...state.song.config, swing } };
    swapAudio();
  },

  setHumanize(percent: number): void {
    const humanize = Math.max(0, Math.min(30, Math.round(percent)));
    state.song = { ...state.song, config: { ...state.song.config, humanize } };
    swapAudio();
  },

  setName(name: string): void {
    state.song = { ...state.song, config: { ...state.song.config, name } };
  },

  selectPattern(label: PatternLabel): void {
    state.selectedPattern = label;
  },

  // --- Sequence / arrangement editing ---
  cycleSequenceSlot(slot: number): void {
    const sequence = [...state.song.sequence];
    if (slot < 0 || slot >= sequence.length) return;
    sequence[slot] = (sequence[slot] + 1) % state.song.patternOrder.length;
    state.song = { ...state.song, sequence };
    swapAudio();
  },

  removeSequenceSlot(slot: number): void {
    if (state.song.sequence.length <= 1) return;
    const sequence = state.song.sequence.filter((_, i) => i !== slot);
    state.song = { ...state.song, sequence };
    if (state.playSeqIdx >= sequence.length) state.playSeqIdx = 0;
    swapAudio();
  },

  appendSequenceSlot(): void {
    const patternIdx = state.song.patternOrder.indexOf(state.selectedPattern);
    const sequence = [...state.song.sequence, Math.max(0, patternIdx)];
    state.song = { ...state.song, sequence };
    swapAudio();
  },

  addPattern(): void {
    const before = state.song.patternOrder.length;
    let next = addPatternToSong(state.song);
    if (next.patternOrder.length === before) return; // already at 8
    const newIdx = next.patternOrder.length - 1;
    next = { ...next, sequence: [...next.sequence, newIdx] };
    state.song = next;
    state.selectedPattern = next.patternOrder[newIdx];
    swapAudio();
  },

  regenPattern(label: PatternLabel): void {
    const { pattern, effects, degrees } = regeneratePattern(state.song, label);
    state.song = {
      ...state.song,
      patterns: { ...state.song.patterns, [label]: pattern },
      patternEffects: { ...state.song.patternEffects, [label]: effects },
      patternChords: { ...state.song.patternChords, [label]: degrees } as Song['patternChords'],
    };
    swapAudio();
  },

  // --- Chord generator ---
  chordDegrees(): number[] {
    return (
      state.song.patternChords?.[state.selectedPattern] ??
      Array(CHORDS_PER_PATTERN).fill(0)
    );
  },

  setChordDegree(slot: number, degree: number): void {
    const degrees = [...this.chordDegrees()];
    degrees[slot] = degree;
    state.song = applyChordsToPattern(state.song, state.selectedPattern, degrees);
    swapAudio();
  },

  rollChords(): void {
    const vibe = state.song.channelVibes?.[1] ?? state.song.config.vibe;
    const degrees = randomProgressionDegrees(vibe);
    state.song = applyChordsToPattern(state.song, state.selectedPattern, degrees);
    swapAudio();
  },

  toggleSnap(): void {
    state.snapToScale = !state.snapToScale;
  },

  /** Snap a note to the song's key/scale when snapping is on (melodic channels only). */
  snapNote(ch: number, note: number): number {
    if (!state.snapToScale || ch === 3 || note <= 0) return note;
    return snapNoteToScale(note, state.song.config.key, state.song.config.scale);
  },

  setChannelVibe(ch: number, vibe: VibeName | null): void {
    state.song = applyChannelVibe(state.song, ch, vibe);
    swapAudio();
  },

  setChannelAlgo(ch: number, algo: string | null): void {
    state.song = applyChannelAlgo(state.song, ch, algo as ChannelAlgos[number]);
    swapAudio();
  },

  setChannelSound(ch: number, sound: string | null): void {
    state.song = applyChannelSound(state.song, ch, sound);
    swapAudio();
  },

  /** Write or clear one step effect in the selected pattern. */
  setEffect(ch: number, row: number, effect: NoteEffect | null): void {
    const label = state.selectedPattern;
    const existing = state.song.patternEffects?.[label];
    const effects = [0, 1, 2, 3].map((c) => [
      ...(existing?.[c] ?? Array(32).fill(null)),
    ]) as PatternEffects;
    effects[ch][row] = effect;
    state.song = {
      ...state.song,
      patternEffects: { ...state.song.patternEffects, [label]: effects },
    };
    swapAudio();
  },

  /** Write one note (0 = clear) into the selected pattern. */
  setNote(ch: number, row: number, note: number): void {
    const label = state.selectedPattern;
    const pattern = state.song.patterns[label].map((c) => [...c]) as Pattern;
    pattern[ch][row + 2] = note;
    state.song = {
      ...state.song,
      patterns: { ...state.song.patterns, [label]: pattern },
    };
    swapAudio();
  },

  /** Audition a note on a channel's instrument (used while editing). */
  previewNote(ch: number, note: number): void {
    if (note <= 0) return;
    const params = [...state.song.instruments[ch]];
    params[2] = (params[2] ?? 0) * 2 ** ((note - 12) / 12);
    const samples = ZZFX.buildSamples(...params);
    zzfxP([samples], 0.6);
  },

  regenChannel(ch: number): void {
    const label = state.selectedPattern;
    const { pattern, effects } = regenerateChannel(state.song, label, ch, { forceAudible: true });
    state.song = {
      ...state.song,
      patterns: { ...state.song.patterns, [label]: pattern },
      patternEffects: { ...state.song.patternEffects, [label]: effects },
    };
    swapAudio();
  },

  /** Regenerate one channel in every pattern of the song. */
  regenChannelAll(ch: number): void {
    state.song = regenerateChannelInAllPatterns(state.song, ch);
    swapAudio();
  },

  async exportPolyend(): Promise<void> {
    if (state.isExporting) return;
    state.isExporting = true;
    try {
      await downloadPolyendProject(state.song, { trackCount: state.exportDevice });
    } finally {
      state.isExporting = false;
    }
  },

  // --- History ---
  undo(): void {
    const prev = undoStack.pop();
    if (!prev) return;
    suppressHistory = true;
    redoStack.push(state.song);
    state.song = prev;
    state.undoCount = undoStack.length;
    state.redoCount = redoStack.length;
    afterSongChange();
  },

  redo(): void {
    const next = redoStack.pop();
    if (!next) return;
    suppressHistory = true;
    undoStack.push(state.song);
    state.song = next;
    state.undoCount = undoStack.length;
    state.redoCount = redoStack.length;
    afterSongChange();
  },

  // --- Projects ---
  saveProject(): void {
    state.projects = saveProject(JSON.parse(JSON.stringify(state.song)));
  },

  loadProject(id: string): void {
    const project = state.projects.find((p) => p.id === id);
    if (!project) return;
    state.song = JSON.parse(JSON.stringify(project.song));
    state.selectedPattern = state.song.patternOrder[0];
    afterSongChange();
  },

  deleteProject(id: string): void {
    state.projects = deleteProject(id);
  },

  exportSongJson(): void {
    const blob = songToFile(state.song);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${sanitizeProjectName(state.song.config.name)}.polygen.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  },

  async importSongJson(file: File): Promise<void> {
    const song = songFromFileText(await file.text());
    state.song = song;
    state.selectedPattern = song.patternOrder[0];
    afterSongChange();
  },

  // --- Share / hash / hardware import ---
  async loadFromHash(): Promise<boolean> {
    const song = await songFromHash(window.location.hash);
    if (!song) return false;
    state.song = song;
    state.selectedPattern = song.patternOrder[0];
    afterSongChange();
    return true;
  },

  async shareUrl(): Promise<void> {
    try {
      const hash = await songToHash(state.song);
      const url = `${window.location.origin}${window.location.pathname}${hash}`;
      window.history.replaceState(null, '', hash);
      await navigator.clipboard.writeText(url);
      state.shareStatus = 'copied';
    } catch {
      state.shareStatus = 'failed';
    }
    window.setTimeout(() => (state.shareStatus = ''), 2000);
  },

  /**
   * Import a Polyend .mtp pattern into the selected pattern (best effort:
   * tracks 1-4 -> lead/harmony/bass/drums, note byte - 36 -> zzfxm note).
   */
  async importMtp(file: File): Promise<void> {
    const parsed = await Tracker.readPattern(file);
    if (!parsed) throw new Error('Unreadable .mtp file');

    const label = state.selectedPattern;
    const pattern = state.song.patterns[label].map((c) => [...c]) as Pattern;

    for (let ch = 0; ch < 4; ch++) {
      const track = parsed.tracks[ch];
      for (let row = 0; row < 32; row++) {
        const step = track?.steps[row];
        if (!step || step.note < 0) {
          pattern[ch][row + 2] = 0;
          continue;
        }
        if (ch === 3) {
          const inst = step.instrument;
          pattern[ch][row + 2] =
            inst <= 3 ? DRUM_NOTES.KICK : inst === 4 ? DRUM_NOTES.SNARE : DRUM_NOTES.HAT;
        } else {
          pattern[ch][row + 2] = Math.max(1, Math.min(48, step.note - 36));
        }
      }
    }

    state.song = {
      ...state.song,
      patterns: { ...state.song.patterns, [label]: pattern },
    };
    swapAudio();
  },

  exportMidi(): void {
    const blob = buildMidiFile(state.song);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${sanitizeProjectName(state.song.config.name)}.mid`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  },

  // --- Stems ---
  async exportStems(): Promise<void> {
    if (state.isExporting) return;
    state.isExporting = true;
    try {
      const { buffers } = renderBuffers(state.song);
      if (!buffers.length) return;
      const zip = new JSZip();
      const names = ['lead', 'harmony', 'bass', 'drums'];
      buffers.forEach(([l, r], ch) => {
        zip.file(`${names[ch]}.wav`, floatsToWav(l, r));
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${sanitizeProjectName(state.song.config.name)}-stems.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } finally {
      state.isExporting = false;
    }
  },

  async exportPatterns(): Promise<void> {
    if (state.isExporting) return;
    state.isExporting = true;
    try {
      await downloadPolyendPatterns(state.song, { trackCount: state.exportDevice });
    } finally {
      state.isExporting = false;
    }
  },

  exportWav(): void {
    const { buffers } = renderBuffers(state.song);
    if (!buffers.length) return;
    const len = buffers[0][0].length;
    const left = new Array<number>(len).fill(0);
    const right = new Array<number>(len).fill(0);
    for (let ch = 0; ch < buffers.length; ch++) {
      const audible = state.solo !== null ? state.solo === ch : !state.muted[ch];
      if (!audible) continue;
      const [l, r] = buffers[ch];
      for (let i = 0; i < len; i++) {
        left[i] += l[i] || 0;
        right[i] += r[i] || 0;
      }
    }
    const blob = floatsToWav(left, right);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${sanitizeProjectName(state.song.config.name)}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  },
};
