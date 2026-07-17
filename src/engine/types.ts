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

// Effects for all 4 channels in one pattern
export type PatternEffects = [ChannelEffects, ChannelEffects, ChannelEffects, ChannelEffects];

export function effectToDisplayString(effect: NoteEffect | null | undefined): string {
  if (!effect) return '----';
  return `${effect.code}${effect.value.toString(16).toUpperCase().padStart(2, '0')}`;
}

// ZzFX 20-parameter sound array
export type ZzFXSound = number[];

// Channel data for one channel in one pattern: [instrumentIndex, pan, ...32 notes]
export type ChannelData = number[];

// A pattern contains 4 channels: melody, harmony, bass, drums
export type Pattern = [ChannelData, ChannelData, ChannelData, ChannelData];

// Drum note encoding — different note values produce different drum sounds
// via pitch variation on the noise instrument
export const DRUM_NOTES = {
  KICK: 1,   // very low pitch = deep kick thump
  SNARE: 14, // mid-high pitch = snare crack
  HAT: 32,   // high pitch = hi-hat sizzle
} as const;

export type DrumType = keyof typeof DRUM_NOTES;

export function drumNoteToName(note: number): string {
  if (note <= 0) return '---';
  if (note <= 6) return 'KCK';
  if (note <= 22) return 'SNR';
  return 'HAT';
}

export type SongLength = 'short' | 'long' | 'epic';

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
  /** Swing amount in percent (0-30): odd 16th rows play late. */
  swing?: number;
  /** Velocity humanization in percent (0-30): random per-note attenuation. */
  humanize?: number;
}

// Per-channel vibe override: null = follow the song's vibe.
// Order matches the channels: [lead, harmony, bass, drums].
export type ChannelVibes = [VibeName | null, VibeName | null, VibeName | null, VibeName | null];

// Per-channel timbre override (archetype name from the sound palette):
// null = vibe-weighted pick. Order matches the channels: [lead, harmony, bass, drums].
export type ChannelSounds = [string | null, string | null, string | null, string | null];

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
}

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
