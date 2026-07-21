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
  canResampleLead,
  duplicatePatternInSong,
  resampleLead,
  floatsToWav,
  generateSong,
  getRandomBpm,
  mutatePattern,
  progressionDegreesFor,
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
import {
  CHANNELS,
  CHANNEL_COUNT,
  DEFAULT_PATTERN_LENGTH,
  DRUM_HIT_NOTE,
  PATTERN_LENGTHS,
  generateInstrumentForChannel,
  isDrumChannel,
} from './engine';
import type { PatternLength } from './engine';

export { PATTERN_LENGTHS };
import {
  DEFAULT_FRAGMENT_COUNT,
  applyFragment,
  fragmentPreviewSong,
  generateFragments,
  macroToTransform,
} from './engine';
import type { ChannelAlgos, ChordMode, Fragment, MacroStep, NoteEffect, Pattern, PatternEffects } from './engine';
import type { NoteName, PatternLabel, ScaleName, Song, SongLength, VibeName } from './engine';

// Selectable timbre palette per channel (re-exported from the engine so the
// grid can render it next to the vibe/algo pickers). null = AUTO.
export { CHANNEL_SOUND_OPTIONS } from './engine';

// Selectable pattern algorithms per channel (null = AUTO, the vibe default).
// The three drum channels share one kit generator, so they share its options.
const LEAD_ALGOS = [
  { value: 'walk', label: 'WALK' },
  { value: 'arp', label: 'ARP' },
  { value: 'riff', label: 'RIFF' },
  { value: 'markov', label: 'MARKOV' },
  { value: 'markovLearn', label: 'MARKOV-LEARN' },
  { value: 'lsystem', label: 'L-SYSTEM' },
  { value: 'motif', label: 'MOTIF' },
];
const HARMONY_ALGOS = [
  { value: 'gapfill', label: 'GAPFILL' },
  { value: 'stabs', label: 'STABS' },
  { value: 'arp', label: 'ARP' },
  { value: 'pedal', label: 'PEDAL' },
];
const BASS_ALGOS = [
  { value: 'groove', label: 'GROOVE' },
  { value: 'acid', label: 'ACID' },
  { value: 'arp', label: 'ARP' },
  { value: 'offbeat', label: 'OFFBEAT' },
  { value: 'poly', label: 'POLYMETER' },
];
const DRUM_ALGOS = [
  { value: 'template', label: 'TEMPLATE' },
  { value: 'euclid', label: 'EUCLID' },
  { value: 'break', label: 'BREAK' },
  { value: 'four', label: '4-FLOOR' },
  { value: 'automata', label: 'AUTOMATA' },
];
const ARP_ALGOS = [
  { value: 'updown', label: 'UP-DOWN' },
  { value: 'octaves', label: 'OCTAVES' },
  { value: 'random', label: 'RANDOM' },
  { value: 'poly', label: 'POLYMETER' },
];
const PAD_ALGOS = [
  { value: 'sustain', label: 'SUSTAIN' },
  { value: 'swell', label: 'SWELL' },
  { value: 'stab', label: 'STAB' },
];

export const CHANNEL_ALGO_OPTIONS: { value: string; label: string }[][] = [
  LEAD_ALGOS,
  HARMONY_ALGOS,
  BASS_ALGOS,
  DRUM_ALGOS, // kick
  DRUM_ALGOS, // snare
  DRUM_ALGOS, // hat
  ARP_ALGOS,
  PAD_ALGOS,
];
import { downloadPolyendPatterns, downloadPolyendProject, sanitizeProjectName } from './export/polyend';
import { buildPaletteZip } from './export/palette';
import { buildMidiFile } from './export/midi';
import { songFromHash, songToHash } from './share';
import { Tracker } from './lib/polyend';
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

export const CHANNEL_LABELS = CHANNELS.map((c) => c.label);

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
  /** Whether drums export as three instruments or one sliced kit. */
  exportDrumKit: 'separate' | 'sliced';
  isExporting: boolean;
  snapToScale: boolean;
  projects: SavedProject[];
  undoCount: number;
  redoCount: number;
  seedInput: string;
  lastSeed: number | null;
  /** Candidate one-bar ideas awaiting audition; starred ones survive a reroll. */
  fragments: Fragment[];
  fragmentChannel: number;
  fragmentPlaying: string | null;
  follow: boolean;
  shareStatus: '' | 'copied' | 'failed';
  /** Channel the instrument panel should follow (set by the grid cursor). */
  instrumentChannel: number | null;
  /** Whether a block has been copied (drives the paste hint in the edit bar). */
  hasClipboard: boolean;
}

const initialSong = loadCurrent() ?? generateSong();

const state = reactive<StoreState>({
  song: initialSong,
  selectedPattern: initialSong.patternOrder[0] ?? 'A',
  isPlaying: false,
  playSeqIdx: 0,
  playRow: -1,
  muted: Array(CHANNEL_COUNT).fill(false),
  solo: null,
  exportDevice: 12,
  exportDrumKit: 'separate',
  isExporting: false,
  snapToScale: true,
  projects: listProjects(),
  undoCount: 0,
  redoCount: 0,
  seedInput: '',
  lastSeed: null,
  fragments: [],
  fragmentChannel: 0,
  fragmentPlaying: null,
  follow: false,
  shareStatus: '',
  instrumentChannel: null,
  hasClipboard: false,
});

// --- History + autosave ------------------------------------------------------
// Every store action replaces state.song immutably, so a watch on the
// reference gives us both undo history and autosave for free.
const HISTORY_LIMIT = 64;
const undoStack: Song[] = [];
const redoStack: Song[] = [];
let suppressHistory = false;
let saveTimer = 0;

// Continuous controls fire one action per input event, so dragging a single
// slider used to push dozens of undo entries and flush the whole history —
// losing pattern edits made minutes earlier. Such an action tags its change
// with a coalesce key instead: while the same key keeps arriving, only the
// snapshot from before the gesture is kept, so one drag undoes as one step.
const COALESCE_WINDOW_MS = 600;
let pendingCoalesce: string | null = null;
let lastCoalesce: string | null = null;
let lastCoalesceAt = 0;

/** Merge this change into the previous one if it shares `key`. */
function coalesceNext(key: string): void {
  pendingCoalesce = key;
}

watch(
  () => state.song,
  (_next, prev) => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveCurrent(state.song), 400);

    const key = pendingCoalesce;
    pendingCoalesce = null;

    if (suppressHistory) {
      suppressHistory = false;
      // An undo/redo ends any gesture: the next edit must start a new entry.
      lastCoalesce = null;
      return;
    }
    if (prev) {
      const now = Date.now();
      const merge = key !== null && key === lastCoalesce && now - lastCoalesceAt < COALESCE_WINDOW_MS;
      lastCoalesce = key;
      lastCoalesceAt = now;

      if (!merge) {
        undoStack.push(prev);
        if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
        redoStack.length = 0;
      }
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

/** Rows in this song's patterns (older songs are 32). */
function patternRows(): number {
  const first = state.song.patterns[state.song.patternOrder[0]];
  return Math.max(1, (first?.[0]?.length ?? 34) - 2);
}

// --- Block editing -----------------------------------------------------------

/** An inclusive rectangle of the grid: channels × rows. */
export interface BlockRect {
  chStart: number;
  chEnd: number;
  rowStart: number;
  rowEnd: number;
}

interface ClipBlock {
  width: number;
  height: number;
  notes: number[][];
  fx: (NoteEffect | null)[][];
}

let clipboard: ClipBlock | null = null;

/** Mutable copies of the selected pattern's notes and effects. */
function editablePattern() {
  const label = state.selectedPattern;
  const rows = patternRows();
  const pattern = state.song.patterns[label].map((c) => [...c]) as Pattern;
  const existing = state.song.patternEffects?.[label];
  const effects = Array.from({ length: CHANNEL_COUNT }, (_, ch) => [
    ...(existing?.[ch] ?? Array(rows).fill(null)),
  ]) as PatternEffects;
  return { label, rows, pattern, effects };
}

function commitPattern(label: PatternLabel, pattern: Pattern, effects: PatternEffects): void {
  state.song = {
    ...state.song,
    patterns: { ...state.song.patterns, [label]: pattern },
    patternEffects: { ...state.song.patternEffects, [label]: effects },
  };
  swapAudio();
}

function applyGains(): void {
  if (!graph) return;
  for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
    const audible = state.solo !== null ? state.solo === ch : !state.muted[ch];
    graph.setChannelGain(ch, audible ? 1 : 0);
  }
}

function tickPlayhead(): void {
  if (!graph || !state.isPlaying) return;
  const pos = graph.getPosition();
  const rowDuration = 60 / graph.bpm / 4;
  // The zzfxm renderer drops the very first beat, so position 0 is row 1.
  const rows = patternRows();
  const totalRows = state.song.sequence.length * rows - 1;
  const globalRow = (Math.floor(pos / rowDuration) + 1) % (totalRows + 1);
  state.playSeqIdx = Math.min(Math.floor(globalRow / rows), state.song.sequence.length - 1);
  state.playRow = globalRow % rows;
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

/**
 * Carry locked instruments (and their lock flags) from the previous song into
 * a freshly generated one, so a pinned sound survives GENERATE / vibe changes.
 */
function keepLockedInstruments(next: Song, previous: Song): Song {
  const locked = previous.lockedInstruments;
  if (!locked?.some(Boolean)) return next;
  const instruments = next.instruments.map((inst, ch) =>
    locked[ch] && previous.instruments[ch] ? [...previous.instruments[ch]] : inst
  );
  return { ...next, instruments, lockedInstruments: [...locked] };
}

export const store = {
  state,

  channelColor(ch: number): string {
    return `var(--ch-${CHANNELS[ch]?.id ?? 'lead'})`;
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
    const previous = state.song;
    const generated = withSeed(seed, () =>
      generateSong(
        { vibe: previous.config.vibe, length: previous.config.length },
        previous.channelVibes,
        previous.channelAlgos,
        previous.structureId,
        previous.channelSounds
      )
    );
    state.song = keepLockedInstruments(generated, previous);
    state.selectedPattern = state.song.patternOrder[0];
    afterSongChange();
  },

  /** True when the selected pattern's lead has enough notes to learn from. */
  canResample(): boolean {
    return canResampleLead(state.song, state.selectedPattern);
  },

  /**
   * Learn the current lead's melodic dialect and write a new lead from it —
   * a variation in the same voice, rather than a fresh idea.
   */
  resampleLead(): void {
    const next = resampleLead(state.song, state.selectedPattern);
    if (next === state.song) return;
    state.song = next;
    swapAudio();
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
    state.song = keepLockedInstruments(regenerateForVibe(state.song, vibe), state.song);
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

  /** Change rows per pattern; regenerates every pattern at the new length. */
  setPatternLength(rows: PatternLength): void {
    if (rows === (state.song.config.patternLength ?? DEFAULT_PATTERN_LENGTH)) return;
    const withLength: Song = {
      ...state.song,
      config: { ...state.song.config, patternLength: rows },
    };
    state.song = keepLockedInstruments(
      regenerateAllPatterns(withLength, { patternLength: rows }),
      state.song
    );
    afterSongChange();
  },

  setLength(length: SongLength): void {
    if (length === state.song.config.length) return;
    state.song = keepLockedInstruments(regenerateWithNewLength(state.song, length), state.song);
    afterSongChange();
  },

  setBpm(bpm: number): void {
    const clamped = Math.max(40, Math.min(220, Math.round(bpm)));
    coalesceNext('bpm');
    state.song = { ...state.song, config: { ...state.song.config, bpm: clamped } };
    swapAudio();
  },

  rollBpm(): void {
    this.setBpm(getRandomBpm(state.song.config.vibe));
  },

  setSwing(percent: number): void {
    const swing = Math.max(0, Math.min(30, Math.round(percent)));
    coalesceNext('swing');
    state.song = { ...state.song, config: { ...state.song.config, swing } };
    swapAudio();
  },

  setHumanize(percent: number): void {
    const humanize = Math.max(0, Math.min(30, Math.round(percent)));
    coalesceNext('humanize');
    state.song = { ...state.song, config: { ...state.song.config, humanize } };
    swapAudio();
  },

  setName(name: string): void {
    // Typing fires per keystroke; a pause longer than the window starts a new
    // entry, so undo steps back through phrases rather than characters.
    coalesceNext('name');
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

  /** Clone the selected pattern into a new slot and append it to the song. */
  duplicatePattern(): void {
    const before = state.song.patternOrder.length;
    let next = duplicatePatternInSong(state.song, state.selectedPattern);
    if (next.patternOrder.length === before) return; // already at 8
    const newIdx = next.patternOrder.length - 1;
    next = { ...next, sequence: [...next.sequence, newIdx] };
    state.song = next;
    state.selectedPattern = next.patternOrder[newIdx];
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
    const degrees = progressionDegreesFor(vibe, state.song.chordMode);
    state.song = applyChordsToPattern(state.song, state.selectedPattern, degrees);
    swapAudio();
  },

  /** Curated progression pools, or a walk of the vibe's harmonic chain. */
  setChordMode(mode: ChordMode): void {
    state.song = { ...state.song, chordMode: mode };
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
    state.song = keepLockedInstruments(applyChannelVibe(state.song, ch, vibe), state.song);
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

  // --- Block editing (copy / paste / clear / transpose) ---

  /** Copy a rectangle of notes+effects out of the selected pattern. */
  copyBlock(block: BlockRect): void {
    const label = state.selectedPattern;
    const pattern = state.song.patterns[label];
    const effects = state.song.patternEffects?.[label];
    const rows = patternRows();

    const notes: number[][] = [];
    const fx: (NoteEffect | null)[][] = [];
    for (let ch = block.chStart; ch <= block.chEnd; ch++) {
      const noteCol: number[] = [];
      const fxCol: (NoteEffect | null)[] = [];
      for (let row = block.rowStart; row <= block.rowEnd && row < rows; row++) {
        noteCol.push(pattern[ch]?.[row + 2] ?? 0);
        fxCol.push(effects?.[ch]?.[row] ?? null);
      }
      notes.push(noteCol);
      fx.push(fxCol);
    }

    clipboard = {
      width: block.chEnd - block.chStart + 1,
      height: Math.min(block.rowEnd, rows - 1) - block.rowStart + 1,
      notes,
      fx,
    };
    state.hasClipboard = true;
  },

  /** Blank the notes and effects inside a rectangle. */
  clearBlock(block: BlockRect): void {
    const { pattern, effects, label, rows } = editablePattern();
    for (let ch = block.chStart; ch <= block.chEnd; ch++) {
      for (let row = block.rowStart; row <= block.rowEnd && row < rows; row++) {
        pattern[ch][row + 2] = 0;
        effects[ch][row] = null;
      }
    }
    commitPattern(label, pattern, effects);
  },

  cutBlock(block: BlockRect): void {
    this.copyBlock(block);
    this.clearBlock(block);
  },

  /** Paste the clipboard with its top-left corner at (ch, row). */
  pasteBlock(ch: number, row: number): void {
    if (!clipboard) return;
    const { pattern, effects, label, rows } = editablePattern();

    for (let c = 0; c < clipboard.width; c++) {
      const targetCh = ch + c;
      if (targetCh >= CHANNEL_COUNT) break;
      for (let r = 0; r < clipboard.height; r++) {
        const targetRow = row + r;
        if (targetRow >= rows) break;
        const note = clipboard.notes[c]?.[r] ?? 0;
        // A pitched note pasted onto a drum channel (or vice versa) is
        // meaningless, so normalise it to that channel's own convention.
        pattern[targetCh][targetRow + 2] = note > 0 && isDrumChannel(targetCh)
          ? DRUM_HIT_NOTE
          : note;
        effects[targetCh][targetRow] = clipboard.fx[c]?.[r] ?? null;
      }
    }
    commitPattern(label, pattern, effects);
  },

  /**
   * Give every note in a rectangle a trigger probability. Playback re-rolls
   * it each render, and it exports as the Polyend's native Chance FX so the
   * hardware keeps re-rolling too. 0 removes it.
   */
  setBlockChance(block: BlockRect, percent: number): void {
    const { pattern, effects, label, rows } = editablePattern();
    const value = Math.max(0, Math.min(100, Math.round(percent)));
    let touched = 0;

    for (let ch = block.chStart; ch <= block.chEnd; ch++) {
      for (let row = block.rowStart; row <= block.rowEnd && row < rows; row++) {
        if (pattern[ch][row + 2] <= 0) continue; // only notes can be chanced
        const existing = effects[ch][row];
        if (value === 0) {
          if (existing?.code === 'CN') effects[ch][row] = null;
        } else {
          effects[ch][row] = { code: 'CN', value };
        }
        touched++;
      }
    }
    if (touched === 0) return;
    commitPattern(label, pattern, effects);
  },

  /** Shift every pitched note in a rectangle by N semitones. */
  transposeBlock(block: BlockRect, semitones: number): void {
    const { pattern, effects, label, rows } = editablePattern();
    let moved = 0;

    for (let ch = block.chStart; ch <= block.chEnd; ch++) {
      // Drum channels have one fixed hit note — transposing them is meaningless
      if (isDrumChannel(ch)) continue;
      for (let row = block.rowStart; row <= block.rowEnd && row < rows; row++) {
        const note = pattern[ch][row + 2];
        if (note <= 0) continue;
        pattern[ch][row + 2] = Math.max(1, Math.min(48, note + semitones));
        moved++;
      }
    }
    if (moved === 0) return;
    commitPattern(label, pattern, effects);
  },

  /**
   * Apply a transform chain to every selected channel's notes.
   *
   * Each channel is transformed independently over just the selected rows, so
   * a retrograde reverses within the selection rather than across the pattern.
   * Drum channels are skipped for pitch-changing transforms only — rhythmic
   * ones (retrograde, rotate, thin) apply to them meaningfully.
   */
  applyTransform(block: BlockRect, steps: MacroStep[]): void {
    if (steps.length === 0) return;
    const { pattern, effects, label, rows } = editablePattern();
    const transform = macroToTransform(steps);
    const pitched = steps.some((s) => s.id === 'transpose' || s.id === 'invert');

    let changed = false;
    for (let ch = block.chStart; ch <= block.chEnd; ch++) {
      if (pitched && isDrumChannel(ch)) continue;

      const rowEnd = Math.min(block.rowEnd, rows - 1);
      if (rowEnd < block.rowStart) continue;

      const slice: number[] = [];
      for (let row = block.rowStart; row <= rowEnd; row++) slice.push(pattern[ch][row + 2] ?? 0);

      const result = transform(slice);
      for (let i = 0; i < slice.length; i++) {
        // Clamp into the playable range rather than letting a chain drift a
        // note out of the octave the instruments are rendered for.
        const next = result[i] > 0 ? Math.max(1, Math.min(48, Math.round(result[i]))) : 0;
        if (next !== slice[i]) changed = true;
        pattern[ch][block.rowStart + i + 2] = next;
      }
    }
    if (!changed) return;
    commitPattern(label, pattern, effects);
  },

  /** Write or clear one step effect in the selected pattern. */
  setEffect(ch: number, row: number, effect: NoteEffect | null): void {
    if (ch < 0 || ch >= CHANNEL_COUNT || row < 0 || row >= patternRows()) return;
    const label = state.selectedPattern;
    const existing = state.song.patternEffects?.[label];
    const rows = patternRows();
    const effects = Array.from({ length: CHANNEL_COUNT }, (_, c) => [
      ...(existing?.[c] ?? Array(rows).fill(null)),
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
    // Guard the bounds here, not just in the UI: writing past the end would
    // silently extend one channel and leave the pattern ragged.
    if (ch < 0 || ch >= CHANNEL_COUNT || row < 0 || row >= patternRows()) return;
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

  // --- Fragment bank ---

  /** Generate a fresh batch of one-bar candidates for a channel. */
  generateFragments(ch: number): void {
    state.fragmentChannel = ch;
    // Starred candidates survive a reroll — that is the point of starring.
    const kept = state.fragments.filter((f) => f.starred && f.channel === ch);
    const fresh = generateFragments(
      state.song,
      state.selectedPattern,
      ch,
      Math.max(1, DEFAULT_FRAGMENT_COUNT - kept.length)
    );
    state.fragments = [...kept, ...fresh];
    state.fragmentPlaying = null;
  },

  toggleFragmentStar(id: string): void {
    state.fragments = state.fragments.map((f) => (f.id === id ? { ...f, starred: !f.starred } : f));
  },

  clearFragments(): void {
    state.fragments = [];
    state.fragmentPlaying = null;
  },

  /**
   * Export the candidates as a project where each pattern is one idea, to be
   * auditioned on the device. Starred candidates go alone if there are any;
   * otherwise the whole batch does.
   */
  async exportPalette(): Promise<void> {
    if (state.isExporting) return;
    const starred = state.fragments.filter((f) => f.starred);
    const chosen = starred.length ? starred : state.fragments;
    if (chosen.length === 0) return;

    state.isExporting = true;
    try {
      const blob = await buildPaletteZip(state.song, chosen, { trackCount: state.exportDevice, drumKit: state.exportDrumKit });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${sanitizeProjectName(state.song.config.name)}-ideas.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } finally {
      state.isExporting = false;
    }
  },

  /** Audition one candidate alone, with every other channel silenced. */
  auditionFragment(id: string): void {
    const fragment = state.fragments.find((f) => f.id === id);
    if (!fragment) return;
    state.fragmentPlaying = id;
    const preview = fragmentPreviewSong(state.song, fragment);
    const buffers = renderSongBuffers(preview);
    if (buffers[0]) zzfxP(buffers[0], 0.8);
    // Clear the indicator after roughly one bar at the song's tempo.
    const barMs = (60000 / state.song.config.bpm) * 4;
    window.setTimeout(() => {
      if (state.fragmentPlaying === id) state.fragmentPlaying = null;
    }, barMs);
  },

  /** Drop a candidate into the selected pattern, tiled across its length. */
  applyFragment(id: string): void {
    const fragment = state.fragments.find((f) => f.id === id);
    if (!fragment) return;
    const label = state.selectedPattern;
    const { pattern, effects } = applyFragment(state.song, label, fragment);
    state.song = {
      ...state.song,
      patterns: { ...state.song.patterns, [label]: pattern },
      patternEffects: { ...state.song.patternEffects, [label]: effects },
    };
    swapAudio();
  },

  // --- Instrument editing ---

  /** Audition a channel's instrument at its base pitch. */
  previewInstrument(ch: number): void {
    const params = state.song.instruments[ch];
    if (!params) return;
    zzfxP([ZZFX.buildSamples(...params)], 0.7);
  },

  setInstrumentParam(ch: number, index: number, value: number): void {
    const instruments = state.song.instruments.map((inst, i) =>
      i === ch ? [...inst] : inst
    );
    if (!instruments[ch]) return;
    instruments[ch][index] = value;
    // One drag of one slider = one undo step; moving to a different slider
    // (or a different channel) starts a new one.
    coalesceNext(`inst:${ch}:${index}`);
    state.song = { ...state.song, instruments };
    swapAudio();
    this.previewInstrument(ch);
  },

  /** New random timbre for one channel; notes and everything else stay. */
  rerollInstrument(ch: number): void {
    const vibe = state.song.channelVibes?.[ch] ?? state.song.config.vibe;
    const sound = state.song.channelSounds?.[ch] ?? null;
    const instruments = [...state.song.instruments];
    instruments[ch] = generateInstrumentForChannel(vibe, ch, sound);
    state.song = { ...state.song, instruments };
    swapAudio();
    this.previewInstrument(ch);
  },

  isInstrumentLocked(ch: number): boolean {
    return state.song.lockedInstruments?.[ch] ?? false;
  },

  /** Locked instruments survive GENERATE and vibe changes. */
  toggleInstrumentLock(ch: number): void {
    const locked = [...(state.song.lockedInstruments ?? Array(CHANNEL_COUNT).fill(false))];
    locked[ch] = !locked[ch];
    state.song = { ...state.song, lockedInstruments: locked };
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

  /**
   * Regenerate one channel in every pattern of the song.
   *
   * Passing a seed reproduces a previous reroll exactly; omitting it rolls a
   * new one and records it, so any result can be returned to later.
   */
  regenChannelAll(ch: number, seed?: number): void {
    state.song = regenerateChannelInAllPatterns(state.song, ch, { seed });
    swapAudio();
  },

  /** Re-run a channel's last reroll — same seed, same result. */
  replayChannelSeed(ch: number): void {
    const seed = state.song.channelSeeds?.[ch];
    if (typeof seed !== 'number') return;
    this.regenChannelAll(ch, seed);
  },

  channelSeed(ch: number): number | null {
    return state.song.channelSeeds?.[ch] ?? null;
  },

  async exportPolyend(): Promise<void> {
    if (state.isExporting) return;
    state.isExporting = true;
    try {
      await downloadPolyendProject(state.song, { trackCount: state.exportDevice, drumKit: state.exportDrumKit });
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

    for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
      const track = parsed.tracks[ch];
      const rows = patternRows();
      for (let row = 0; row < rows; row++) {
        const step = track?.steps[row];
        if (!step || step.note < 0) {
          pattern[ch][row + 2] = 0;
          continue;
        }
        // Tracks map 1:1 to channels now, so drums are just "hit or not".
        pattern[ch][row + 2] = isDrumChannel(ch)
          ? DRUM_HIT_NOTE
          : Math.max(1, Math.min(48, step.note - 36));
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
      buffers.forEach(([l, r], ch) => {
        const name = CHANNELS[ch]?.id ?? `ch${ch + 1}`;
        zip.file(`${ch + 1}-${name}.wav`, floatsToWav(l, r));
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
      await downloadPolyendPatterns(state.song, { trackCount: state.exportDevice, drumKit: state.exportDrumKit });
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
