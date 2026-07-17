import { reactive, computed } from 'vue';
import {
  AudioGraph,
  CHORDS_PER_PATTERN,
  ZZFX,
  applyChannelAlgo,
  applyChannelVibe,
  applyChordsToPattern,
  applySongStructure,
  floatsToWav,
  generateSong,
  getRandomBpm,
  randomProgressionDegrees,
  regenerateAllPatterns,
  regenerateChannel,
  regenerateForVibe,
  regeneratePattern,
  regenerateWithNewLength,
  renderSongBuffers,
  snapNoteToScale,
  zzfxP,
} from './engine';
import type { ChannelAlgos, Pattern } from './engine';
import type { NoteName, PatternLabel, ScaleName, Song, SongLength, VibeName } from './engine';

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
}

const state = reactive<StoreState>({
  song: generateSong(),
  selectedPattern: 'A',
  isPlaying: false,
  playSeqIdx: 0,
  playRow: -1,
  muted: [false, false, false, false],
  solo: null,
  exportDevice: 12,
  isExporting: false,
  snapToScale: true,
});

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
    state.song = generateSong(
      { vibe: state.song.config.vibe, length: state.song.config.length },
      state.song.channelVibes,
      state.song.channelAlgos,
      state.song.structureId
    );
    state.selectedPattern = state.song.patternOrder[0];
    afterSongChange();
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

  setName(name: string): void {
    state.song = { ...state.song, config: { ...state.song.config, name } };
  },

  selectPattern(label: PatternLabel): void {
    state.selectedPattern = label;
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
    const { pattern, effects } = regenerateChannel(state.song, label, ch);
    state.song = {
      ...state.song,
      patterns: { ...state.song.patterns, [label]: pattern },
      patternEffects: { ...state.song.patternEffects, [label]: effects },
    };
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
