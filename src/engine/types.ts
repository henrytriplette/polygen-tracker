export type NoteName = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export type ScaleName = 'major' | 'minor' | 'pentatonic' | 'dorian' | 'mixolydian' | 'harmonicMinor';

export type VibeName =
  | 'adventure'
  | 'battle'
  | 'dungeon'
  | 'titleScreen'
  | 'boss'
  | 'synthwave'
  | 'house'
  | 'lofi'
  | 'funk'
  | 'punk'
  | 'techno'
  | 'dub'
  | 'idm'
  | 'hardcore'
  | 'dnb';

export type PatternLabel = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

// Effect codes — retro-authentic per-note effects
export type EffectCode = 'SU' | 'SD' | 'VB' | 'DT' | 'ST' | 'PD' | 'BC' | 'TR';

export const EFFECT_CODES: EffectCode[] = ['SU', 'SD', 'VB', 'DT', 'ST', 'PD', 'BC', 'TR'];

export interface NoteEffect {
  code: EffectCode;
  value: number; // 0x00-0xFF
}

// Per-channel effects for one pattern (parallel to 32 notes in ChannelData)
export type ChannelEffects = (NoteEffect | null)[];

// Effects for every channel in one pattern (length CHANNEL_COUNT)
export type PatternEffects = ChannelEffects[];

export function effectToDisplayString(effect: NoteEffect | null | undefined): string {
  if (!effect) return '----';
  return `${effect.code}${effect.value.toString(16).toUpperCase().padStart(2, '0')}`;
}

// ZzFX 20-parameter sound array
export type ZzFXSound = number[];

// Channel data for one channel in one pattern: [instrumentIndex, pan, ...32 notes]
export type ChannelData = number[];

// A pattern holds one ChannelData per channel (length CHANNEL_COUNT)
export type Pattern = ChannelData[];

//----------------------------------
// Channels
//----------------------------------
// Eight channels, matching the Polyend Tracker's eight audio tracks.
// Drums get one track each so simultaneous hits are possible (they used to
// collapse into a single channel), and ARP/PAD fill the remaining tracks.

/** Which generation/instrument/effect tables a channel draws from. */
export type ChannelFamily = 'lead' | 'harmony' | 'bass' | 'drums';

export interface ChannelDef {
  id: string;
  label: string;
  family: ChannelFamily;
}

export const CHANNELS: ChannelDef[] = [
  { id: 'lead', label: 'LEAD', family: 'lead' },
  { id: 'harmony', label: 'HARM', family: 'harmony' },
  { id: 'bass', label: 'BASS', family: 'bass' },
  { id: 'kick', label: 'KICK', family: 'drums' },
  { id: 'snare', label: 'SNR', family: 'drums' },
  { id: 'hat', label: 'HAT', family: 'drums' },
  { id: 'arp', label: 'ARP', family: 'harmony' },
  { id: 'pad', label: 'PAD', family: 'harmony' },
];

export const CHANNEL_COUNT = CHANNELS.length;

export const CH_LEAD = 0;
export const CH_HARMONY = 1;
export const CH_BASS = 2;
export const CH_KICK = 3;
export const CH_SNARE = 4;
export const CH_HAT = 5;
export const CH_ARP = 6;
export const CH_PAD = 7;

export const DRUM_CHANNELS = [CH_KICK, CH_SNARE, CH_HAT];

export function isDrumChannel(ch: number): boolean {
  return ch >= CH_KICK && ch <= CH_HAT;
}

export function channelFamily(ch: number): ChannelFamily {
  return CHANNELS[ch]?.family ?? 'lead';
}

/** Every drum channel plays its own instrument at base pitch. */
export const DRUM_HIT_NOTE = 12;

// Legacy 4-channel drum encoding — kept so old saved songs can be migrated.
export const DRUM_NOTES = {
  KICK: 1,
  SNARE: 14,
  HAT: 32,
} as const;

export type DrumType = keyof typeof DRUM_NOTES;

/** Three-character grid label for a hit on a drum channel. */
const DRUM_HIT_LABELS: Record<number, string> = {
  [CH_KICK]: 'KCK',
  [CH_SNARE]: 'SNR',
  [CH_HAT]: 'HAT',
};

export function drumChannelLabel(ch: number): string {
  return DRUM_HIT_LABELS[ch] ?? 'HIT';
}

export function drumNoteToName(note: number): string {
  if (note <= 0) return '---';
  if (note <= 6) return 'KCK';
  if (note <= 22) return 'SNR';
  return 'HAT';
}

export type SongLength = 'short' | 'long' | 'epic';

//----------------------------------
// Pattern length
//----------------------------------
// A row is always a 16th note, so length changes how LONG a pattern is, not
// how fast it plays. Content therefore repeats at its natural period rather
// than stretching: 8-slot rhythm templates cycle every 8 rows, drum templates
// every 32, and the chord progression always divides the pattern into four
// equal segments.

export type PatternLength = 16 | 32 | 64 | 128;

export const PATTERN_LENGTHS: PatternLength[] = [16, 32, 64, 128];

export const DEFAULT_PATTERN_LENGTH: PatternLength = 32;

/** Period of the 8-slot melody/bass/harmony rhythm templates. */
export const RHYTHM_PERIOD = 8;

/** Period of the drum templates (they are written across 32 rows). */
export const DRUM_PERIOD = 32;

/** Chords per pattern — always four, whatever the length. */
export const CHORD_SEGMENTS = 4;

export function rowsPerChord(length: number): number {
  return Math.max(1, Math.floor(length / CHORD_SEGMENTS));
}

// Section roles define HOW a unique pattern is generated
export type SectionRole =
  | 'verse'      // main theme, full arrangement
  | 'contrast'   // different melody/chords, tension
  | 'bridge'     // transitional, sparser, breathing room
  | 'breakdown'  // drums+bass only
  | 'climax'     // highest energy / drop
  | 'chorus'     // the hook — bigger than a verse, catchier than a climax
  | 'refrain';   // short recurring hook line over thinner backing

// A structure template: roles for each unique pattern + the playback sequence
export interface StructureTemplate {
  roles: SectionRole[];   // role per unique pattern (A=roles[0], B=roles[1], etc.)
  sequence: number[];     // playback order referencing pattern indices
}

export interface SongConfig {
  name: string;
  vibe: VibeName;
  key: NoteName;
  scale: ScaleName;
  bpm: number;
  length: SongLength;
  /** Rows per pattern (16/32/64/128). Defaults to 32 for older songs. */
  patternLength?: PatternLength;
  /** Swing amount in percent (0-30): odd 16th rows play late. */
  swing?: number;
  /** Velocity humanization in percent (0-30): random per-note attenuation. */
  humanize?: number;
}

// Per-channel vibe override: null = follow the song's vibe.
// One entry per channel, in CHANNELS order.
export type ChannelVibes = (VibeName | null)[];

// Per-channel timbre override (archetype name from the sound palette):
// null = vibe-weighted pick. Order matches the channels: [lead, harmony, bass, drums].
export type ChannelSounds = (string | null)[];

export interface Song {
  config: SongConfig;
  instruments: ZzFXSound[];
  patterns: Record<PatternLabel, Pattern>;
  patternRoles: Record<PatternLabel, SectionRole>;
  patternEffects: Record<PatternLabel, PatternEffects>;
  sequence: number[];
  patternOrder: PatternLabel[];
  channelVibes?: ChannelVibes;
  /** Per-channel timbre override (archetype name); null = vibe-weighted pick. */
  channelSounds?: ChannelSounds;
  /** Chord progression per pattern as scale degrees (one chord per 8 rows). */
  patternChords?: Record<PatternLabel, number[]>;
  /** Per-channel pattern-generator override: null = vibe-driven default. */
  channelAlgos?: import('./altPatterns').ChannelAlgos;
  /** Selected song-structure option id: null = the vibe's own structures. */
  structureId?: string | null;
  /** Per-channel: keep this instrument when regenerating the song. */
  lockedInstruments?: boolean[];
  /** How chord progressions are chosen: curated pools, or a Markov walk. */
  chordMode?: ChordMode;
}

/**
 * 'pool'   — pick from the vibe's curated progressions (the original behaviour)
 * 'markov' — walk that vibe's harmonic transition chain
 */
export type ChordMode = 'pool' | 'markov';

export interface ScaleNote {
  name: string;
  note: number; // ZzFXM note value (0 = rest, 12 = instrument base freq)
}

export interface VibeConfig {
  bpmRange: [number, number];
  preferredScales: ScaleName[];
  melodyDensity: number;
  bassDensity: [number, number];
  drumIntensity: 'sparse' | 'light' | 'medium' | 'high' | 'intense';
  structures: Record<SongLength, StructureTemplate[]>;
  fxChance: number;
}
