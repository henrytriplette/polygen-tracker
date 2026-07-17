import {
  Song,
  SongConfig,
  SongLength,
  SectionRole,
  Pattern,
  PatternLabel,
  PatternEffects,
  ChannelEffects,
  ChannelVibes,
  ChannelSounds,
  NoteEffect,
  VibeName,
} from './types';
import { VIBE_CONFIG, getRandomBpm } from './vibes';
import { generateInstruments, generateInstrumentForChannel } from './instruments';
import { generateDrumPattern } from './drums';
import { generateBassPattern } from './bass';
import { generateMelodyPattern } from './melody';
import { generateHarmonyPattern } from './harmony';
import { progressionFromDegrees, randomProgressionDegrees, ChordProgression } from './chords';
import {
  ChannelAlgos,
  generateAcidBass,
  generateArpBass,
  generateArpHarmony,
  generateArpLead,
  generateBreakDrums,
  generateEuclidDrums,
  generateFourDrums,
  generateOffbeatBass,
  generatePedalHarmony,
  generateRiffLead,
  generateStabsHarmony,
} from './altPatterns';
import { generatePatternEffects, generateChannelEffects, applyEffect } from './effects';
import { generateSongName } from './songNames';
import { findStructure } from './structures';
import { zzfxMChannels } from './zzfx';

const PATTERN_LABELS: PatternLabel[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const ROWS = 32;

// Role-based density multipliers — how each section role modifies
// the vibe's base melody/bass density
const ROLE_MELODY_MULTIPLIER: Record<SectionRole, number> = {
  verse: 1.0,
  contrast: 1.0,
  bridge: 0.6,
  breakdown: 0,      // no melody
  climax: 1.4,
  chorus: 1.3,       // the hook — denser than a verse
  refrain: 1.1,      // prominent lead line
};

const ROLE_BASS_MULTIPLIER: Record<SectionRole, number> = {
  verse: 1.0,
  contrast: 1.0,
  bridge: 0.7,
  breakdown: 1.0,    // bass stays in breakdowns
  climax: 1.2,
  chorus: 1.15,
  refrain: 0.9,      // backing thins so the hook line carries
};

// Resolve the vibe a channel should use: its override, or the song's vibe.
function vibeAt(config: SongConfig, channelVibes: ChannelVibes | undefined, ch: number): VibeName {
  return channelVibes?.[ch] ?? config.vibe;
}

// --- Per-channel generator dispatch ---
// Each channel can override its pattern algorithm; null keeps the vibe default.

function makeLead(
  algo: ChannelAlgos[0],
  config: SongConfig,
  density: number,
  progression: ChordProgression,
): Pattern[0] {
  switch (algo) {
    case 'arp': return generateArpLead(progression, density);
    case 'riff': return generateRiffLead(config.key, config.scale, progression);
    default: return generateMelodyPattern(config.key, config.scale, density, progression);
  }
}

function makeHarmony(
  algo: ChannelAlgos[1],
  config: SongConfig,
  melodyNotes: number[],
  progression: ChordProgression,
): Pattern[1] {
  switch (algo) {
    case 'stabs': return generateStabsHarmony(progression);
    case 'arp': return generateArpHarmony(progression);
    case 'pedal': return generatePedalHarmony(progression);
    default: return generateHarmonyPattern(config.key, config.scale, melodyNotes, progression);
  }
}

function makeBass(
  algo: ChannelAlgos[2],
  config: SongConfig,
  kickPattern: number[],
  density: [number, number],
  vibe: VibeName,
  progression: ChordProgression,
): Pattern[2] {
  switch (algo) {
    case 'acid': return generateAcidBass(progression);
    case 'offbeat': return generateOffbeatBass(progression);
    case 'arp': return generateArpBass(progression);
    default: return generateBassPattern(config.key, config.scale, kickPattern, density, vibe, progression);
  }
}

function makeDrums(
  algo: ChannelAlgos[3],
  vibe: VibeName,
): { channelData: Pattern[3]; kickPattern: number[] } {
  switch (algo) {
    case 'euclid': return generateEuclidDrums(vibe);
    case 'break': return generateBreakDrums();
    case 'four': return generateFourDrums();
    default: return generateDrumPattern(vibe);
  }
}

function generatePatternForRole(
  config: SongConfig,
  role: SectionRole,
  channelVibes?: ChannelVibes,
  fixedDegrees?: number[],
  channelAlgos?: ChannelAlgos,
): { pattern: Pattern; effects: PatternEffects; degrees: number[] } {
  const melodyVibe = vibeAt(config, channelVibes, 0);
  const harmonyVibe = vibeAt(config, channelVibes, 1);
  const bassVibe = vibeAt(config, channelVibes, 2);
  const drumVibe = vibeAt(config, channelVibes, 3);

  // Chord progression flavor follows the harmony channel's vibe — the key and
  // scale stay global, so every channel remains harmonically locked.
  // A user-edited progression (fixedDegrees) takes precedence.
  const degrees = fixedDegrees ?? randomProgressionDegrees(harmonyVibe);
  const progression = progressionFromDegrees(degrees, config.key, config.scale);

  // Drums always play (backbone of every section)
  const { channelData: drumChannel, kickPattern } = makeDrums(channelAlgos?.[3] ?? null, drumVibe);

  // Apply role-based density scaling, per-channel vibe densities
  const melodyDensity = Math.min(1, VIBE_CONFIG[melodyVibe].melodyDensity * ROLE_MELODY_MULTIPLIER[role]);
  const bassDensityScale = ROLE_BASS_MULTIPLIER[role];
  const bassDensity = VIBE_CONFIG[bassVibe].bassDensity;
  const scaledBassDensity: [number, number] = [
    Math.round(bassDensity[0] * bassDensityScale),
    Math.round(bassDensity[1] * bassDensityScale),
  ];

  // Breakdown: silent lead + harmony
  if (role === 'breakdown') {
    const silentChannel = [0, 0, ...Array(ROWS).fill(0)];
    const bassChannel = makeBass(
      channelAlgos?.[2] ?? null, config, kickPattern,
      scaledBassDensity, bassVibe, progression
    );
    const pattern = [silentChannel, silentChannel, bassChannel, drumChannel] as Pattern;
    const effects = generatePatternEffects(pattern, config, role, channelVibes);
    return { pattern, effects, degrees };
  }

  // Melody
  const melodyChannel = makeLead(channelAlgos?.[0] ?? null, config, melodyDensity, progression);

  // Bass
  const bassChannel = makeBass(
    channelAlgos?.[2] ?? null, config, kickPattern,
    scaledBassDensity, bassVibe, progression
  );

  // Harmony
  const melodyNotes = melodyChannel.slice(2);
  const harmonyChannel = makeHarmony(channelAlgos?.[1] ?? null, config, melodyNotes, progression);

  // Bridge/refrain: thin out harmony (50% chance to silence each hit) —
  // bridges for breathing room, refrains so the hook line stays in front
  if (role === 'bridge' || role === 'refrain') {
    for (let i = 2; i < harmonyChannel.length; i++) {
      if (harmonyChannel[i] > 0 && Math.random() < 0.5) {
        harmonyChannel[i] = 0;
      }
    }
  }

  const pattern = [melodyChannel, harmonyChannel, bassChannel, drumChannel] as Pattern;
  const effects = generatePatternEffects(pattern, config, role, channelVibes);
  return { pattern, effects, degrees };
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Pick a structure template: a selected named structure wins, otherwise the
// vibe's own genre-specific templates.
function pickStructureTemplate(vibe: VibeName, length: SongLength, structureId?: string | null) {
  const named = findStructure(structureId);
  const pool = named ? named.structures[length] : VIBE_CONFIG[vibe].structures[length];
  return pick(pool);
}

export function generateSong(
  config?: Partial<SongConfig>,
  channelVibes?: ChannelVibes,
  channelAlgos?: ChannelAlgos,
  structureId?: string | null,
  channelSounds?: ChannelSounds,
): Song {
  const vibe: VibeName = config?.vibe ?? 'adventure';
  const vibeConfig = VIBE_CONFIG[vibe];
  const length: SongLength = config?.length ?? 'long';

  const fullConfig: SongConfig = {
    name: config?.name ?? generateSongName(vibe),
    vibe,
    key: config?.key ?? 'C',
    scale: config?.scale ?? pick(vibeConfig.preferredScales),
    bpm: config?.bpm ?? getRandomBpm(vibe),
    length,
  };

  const vibes: ChannelVibes = channelVibes ?? [null, null, null, null];
  const algos: ChannelAlgos = channelAlgos ?? [null, null, null, null];
  const sounds: ChannelSounds = channelSounds ?? [null, null, null, null];
  const instruments = [0, 1, 2, 3].map((ch) =>
    generateInstrumentForChannel(vibes[ch] ?? vibe, ch, sounds[ch])
  );

  // Pick a structure template: named structure override, or vibe + length
  const template = pickStructureTemplate(vibe, length, structureId);

  // Generate unique patterns, each with its assigned role
  const patterns: Record<PatternLabel, Pattern> = {} as Record<PatternLabel, Pattern>;
  const patternRoles: Record<PatternLabel, SectionRole> = {} as Record<PatternLabel, SectionRole>;
  const patternEffects: Record<PatternLabel, PatternEffects> = {} as Record<PatternLabel, PatternEffects>;
  const patternOrder: PatternLabel[] = [];

  const patternChords: Record<PatternLabel, number[]> = {} as Record<PatternLabel, number[]>;

  for (let i = 0; i < template.roles.length; i++) {
    const label = PATTERN_LABELS[i];
    const role = template.roles[i];
    const { pattern, effects, degrees } = generatePatternForRole(fullConfig, role, vibes, undefined, algos);
    patterns[label] = pattern;
    patternRoles[label] = role;
    patternEffects[label] = effects;
    patternChords[label] = degrees;
    patternOrder.push(label);
  }

  return {
    config: fullConfig,
    instruments,
    patterns,
    patternRoles,
    patternEffects,
    sequence: [...template.sequence],
    patternOrder,
    channelVibes: vibes,
    channelAlgos: algos,
    channelSounds: sounds,
    patternChords,
    structureId: structureId ?? null,
  };
}

/**
 * Regenerate for a new vibe: new instruments, structure, patterns, effects, BPM.
 * Keeps name, key, scale, length from the existing song.
 * BPM is re-rolled from the new vibe's preferred range.
 */
export function regenerateForVibe(song: Song, newVibe: VibeName): Song {
  return generateSong(
    {
      name: song.config.name,
      vibe: newVibe,
      key: song.config.key,
      scale: song.config.scale,
      bpm: getRandomBpm(newVibe),
      length: song.config.length,
    },
    song.channelVibes,
    song.channelAlgos,
    song.structureId,
    song.channelSounds
  );
}

/**
 * Regenerate all patterns in-place for a new config (key/scale change).
 * Keeps instruments, structure (patternOrder, sequence, roles) intact.
 */
export function regenerateAllPatterns(
  song: Song,
  configOverrides: Partial<SongConfig>,
): Song {
  const newConfig: SongConfig = { ...song.config, ...configOverrides };
  const patterns: Record<PatternLabel, Pattern> = {} as Record<PatternLabel, Pattern>;
  const patternEffects: Record<PatternLabel, PatternEffects> = {} as Record<PatternLabel, PatternEffects>;

  const patternChords: Record<PatternLabel, number[]> = {} as Record<PatternLabel, number[]>;

  for (const label of song.patternOrder) {
    const role = song.patternRoles[label] ?? 'verse';
    // Keep the stored progression: chords are scale degrees, so they stay
    // valid when only the key/scale changes.
    const { pattern, effects, degrees } = generatePatternForRole(
      newConfig, role, song.channelVibes, song.patternChords?.[label], song.channelAlgos
    );
    patterns[label] = pattern;
    patternEffects[label] = effects;
    patternChords[label] = degrees;
  }

  return {
    ...song,
    config: newConfig,
    patterns,
    patternEffects,
    patternChords,
  };
}

/**
 * Regenerate with a new length: picks a new structure template, generates
 * new patterns for each role. Keeps instruments.
 */
export function regenerateWithNewLength(
  song: Song,
  newLength: SongLength,
): Song {
  const newConfig: SongConfig = { ...song.config, length: newLength };
  const template = pickStructureTemplate(newConfig.vibe, newLength, song.structureId);

  const patterns: Record<PatternLabel, Pattern> = {} as Record<PatternLabel, Pattern>;
  const patternRoles: Record<PatternLabel, SectionRole> = {} as Record<PatternLabel, SectionRole>;
  const patternEffects: Record<PatternLabel, PatternEffects> = {} as Record<PatternLabel, PatternEffects>;
  const patternOrder: PatternLabel[] = [];

  const patternChords: Record<PatternLabel, number[]> = {} as Record<PatternLabel, number[]>;

  for (let i = 0; i < template.roles.length; i++) {
    const label = PATTERN_LABELS[i];
    const role = template.roles[i];
    const { pattern, effects, degrees } = generatePatternForRole(
      newConfig, role, song.channelVibes, undefined, song.channelAlgos
    );
    patterns[label] = pattern;
    patternRoles[label] = role;
    patternEffects[label] = effects;
    patternChords[label] = degrees;
    patternOrder.push(label);
  }

  return {
    ...song,
    config: newConfig,
    patterns,
    patternRoles,
    patternEffects,
    sequence: [...template.sequence],
    patternOrder,
    patternChords,
  };
}

/**
 * Switch to a different song structure (null = back to the vibe's own forms).
 * Picks a template from the chosen structure and regenerates the patterns
 * for its roles; instruments, config, and channel overrides are kept.
 */
export function applySongStructure(song: Song, structureId: string | null): Song {
  const template = pickStructureTemplate(song.config.vibe, song.config.length, structureId);

  const patterns: Record<PatternLabel, Pattern> = {} as Record<PatternLabel, Pattern>;
  const patternRoles: Record<PatternLabel, SectionRole> = {} as Record<PatternLabel, SectionRole>;
  const patternEffects: Record<PatternLabel, PatternEffects> = {} as Record<PatternLabel, PatternEffects>;
  const patternChords: Record<PatternLabel, number[]> = {} as Record<PatternLabel, number[]>;
  const patternOrder: PatternLabel[] = [];

  for (let i = 0; i < template.roles.length; i++) {
    const label = PATTERN_LABELS[i];
    const role = template.roles[i];
    const { pattern, effects, degrees } = generatePatternForRole(
      song.config, role, song.channelVibes, undefined, song.channelAlgos
    );
    patterns[label] = pattern;
    patternRoles[label] = role;
    patternEffects[label] = effects;
    patternChords[label] = degrees;
    patternOrder.push(label);
  }

  return {
    ...song,
    patterns,
    patternRoles,
    patternEffects,
    patternChords,
    sequence: [...template.sequence],
    patternOrder,
    structureId,
  };
}

/** Regenerate one channel in every pattern (keeps everything else). */
export function regenerateChannelInAllPatterns(
  song: Song,
  channelIndex: number,
  options: { forceAudible?: boolean } = {}
): Song {
  let next: Song = song;
  for (const label of song.patternOrder) {
    const { pattern, effects } = regenerateChannel(next, label, channelIndex, options);
    next = {
      ...next,
      patterns: { ...next.patterns, [label]: pattern },
      patternEffects: { ...next.patternEffects, [label]: effects },
    };
  }
  return next;
}

/** Append a freshly generated pattern (next free label, up to 8). */
export function addPatternToSong(song: Song, role: SectionRole = 'verse'): Song {
  if (song.patternOrder.length >= PATTERN_LABELS.length) return song;
  const label = PATTERN_LABELS[song.patternOrder.length];
  const { pattern, effects, degrees } = generatePatternForRole(
    song.config, role, song.channelVibes, undefined, song.channelAlgos
  );
  return {
    ...song,
    patterns: { ...song.patterns, [label]: pattern },
    patternRoles: { ...song.patternRoles, [label]: role },
    patternEffects: { ...song.patternEffects, [label]: effects },
    patternChords: { ...song.patternChords, [label]: degrees } as Song['patternChords'],
    patternOrder: [...song.patternOrder, label],
  };
}

export function regeneratePattern(
  song: Song,
  patternLabel: PatternLabel
): { pattern: Pattern; effects: PatternEffects; degrees: number[] } {
  const role = song.patternRoles[patternLabel] ?? 'verse';
  return generatePatternForRole(song.config, role, song.channelVibes, undefined, song.channelAlgos);
}

export function regenerateChannel(
  song: Song,
  patternLabel: PatternLabel,
  channelIndex: number,
  options: { forceAudible?: boolean } = {}
): { pattern: Pattern; effects: PatternEffects } {
  const pattern = [...song.patterns[patternLabel]] as Pattern;
  let role = song.patternRoles[patternLabel] ?? 'verse';
  // "Populate" mode: an explicit request for lead/harmony in a breakdown
  // pattern should produce notes, not respect the role's silence.
  if (options.forceAudible && role === 'breakdown' && channelIndex < 2) {
    role = 'verse';
  }
  const channelVibe = vibeAt(song.config, song.channelVibes, channelIndex);
  const channelVibeConfig = VIBE_CONFIG[channelVibe];

  // Reuse the pattern's stored progression so the regenerated channel stays
  // harmonically aligned with the others; fall back to a fresh one.
  const degrees = song.patternChords?.[patternLabel]
    ?? randomProgressionDegrees(vibeAt(song.config, song.channelVibes, 1));
  const progression = progressionFromDegrees(degrees, song.config.key, song.config.scale);

  const melodyMult = ROLE_MELODY_MULTIPLIER[role];
  const bassMult = ROLE_BASS_MULTIPLIER[role];

  const algos = song.channelAlgos;

  switch (channelIndex) {
    case 0: {
      if (role === 'breakdown') {
        pattern[0] = [0, 0, ...Array(ROWS).fill(0)];
      } else {
        pattern[0] = makeLead(
          algos?.[0] ?? null, song.config,
          Math.min(1, channelVibeConfig.melodyDensity * melodyMult),
          progression
        );
      }
      break;
    }
    case 1: {
      if (role === 'breakdown') {
        pattern[1] = [0, 0, ...Array(ROWS).fill(0)];
      } else {
        const melodyNotes = pattern[0].slice(2);
        pattern[1] = makeHarmony(algos?.[1] ?? null, song.config, melodyNotes, progression);
      }
      break;
    }
    case 2: {
      const kickPattern = pattern[3].slice(2).map(n => n > 0 ? 1 : 0);
      pattern[2] = makeBass(
        algos?.[2] ?? null, song.config, kickPattern,
        [
          Math.round(channelVibeConfig.bassDensity[0] * bassMult),
          Math.round(channelVibeConfig.bassDensity[1] * bassMult),
        ],
        channelVibe, progression
      );
      break;
    }
    case 3: {
      const { channelData } = makeDrums(algos?.[3] ?? null, channelVibe);
      pattern[3] = channelData;
      break;
    }
  }

  // Preserve effects for unchanged channels, regenerate for the changed one
  const existingEffects = song.patternEffects?.[patternLabel];
  const effects: PatternEffects = [
    existingEffects?.[0] ?? Array(ROWS).fill(null),
    existingEffects?.[1] ?? Array(ROWS).fill(null),
    existingEffects?.[2] ?? Array(ROWS).fill(null),
    existingEffects?.[3] ?? Array(ROWS).fill(null),
  ];
  effects[channelIndex] = generateChannelEffects(
    channelIndex, pattern[channelIndex].slice(2), song.config, role, channelVibe
  );

  return { pattern, effects };
}

/**
 * Apply a user-edited chord progression (scale degrees, one per 8 rows) to a
 * pattern. Harmony and bass are regenerated to follow the new chords; lead
 * and drums are left untouched (regenerate them separately if wanted).
 */
export function applyChordsToPattern(
  song: Song,
  patternLabel: PatternLabel,
  degrees: number[],
): Song {
  const role = song.patternRoles[patternLabel] ?? 'verse';
  const progression = progressionFromDegrees(degrees, song.config.key, song.config.scale);
  const pattern = [...song.patterns[patternLabel]] as Pattern;

  const bassVibe = vibeAt(song.config, song.channelVibes, 2);
  const bassMult = ROLE_BASS_MULTIPLIER[role];
  const bassDensity = VIBE_CONFIG[bassVibe].bassDensity;
  const kickPattern = pattern[3].slice(2).map(n => (n > 0 ? 1 : 0));

  pattern[2] = makeBass(
    song.channelAlgos?.[2] ?? null, song.config, kickPattern,
    [Math.round(bassDensity[0] * bassMult), Math.round(bassDensity[1] * bassMult)],
    bassVibe, progression
  );

  if (role === 'breakdown') {
    pattern[1] = [0, 0, ...Array(ROWS).fill(0)];
  } else {
    pattern[1] = makeHarmony(
      song.channelAlgos?.[1] ?? null, song.config, pattern[0].slice(2), progression
    );
  }

  const existingEffects = song.patternEffects?.[patternLabel];
  const effects: PatternEffects = [
    existingEffects?.[0] ?? Array(ROWS).fill(null),
    generateChannelEffects(1, pattern[1].slice(2), song.config, role, vibeAt(song.config, song.channelVibes, 1)),
    generateChannelEffects(2, pattern[2].slice(2), song.config, role, bassVibe),
    existingEffects?.[3] ?? Array(ROWS).fill(null),
  ];

  return {
    ...song,
    patterns: { ...song.patterns, [patternLabel]: pattern },
    patternEffects: { ...song.patternEffects, [patternLabel]: effects },
    patternChords: { ...song.patternChords, [patternLabel]: [...degrees] } as Record<PatternLabel, number[]>,
  };
}

/**
 * Set (or clear, with null) one channel's pattern algorithm and regenerate
 * that channel in every pattern. Instruments are untouched.
 */
export function applyChannelAlgo(
  song: Song,
  channelIndex: number,
  algo: ChannelAlgos[number],
): Song {
  const channelAlgos = [...(song.channelAlgos ?? [null, null, null, null])] as ChannelAlgos;
  channelAlgos[channelIndex] = algo as never;

  let next: Song = { ...song, channelAlgos };
  for (const label of next.patternOrder) {
    const { pattern, effects } = regenerateChannel(next, label, channelIndex);
    next = {
      ...next,
      patterns: { ...next.patterns, [label]: pattern },
      patternEffects: { ...next.patternEffects, [label]: effects },
    };
  }
  return next;
}

/**
 * Set (or clear, with null) one channel's vibe override. Regenerates that
 * channel's instrument and its notes in every pattern so the new style is
 * immediately audible; the other channels are untouched.
 */
export function applyChannelVibe(song: Song, channelIndex: number, vibe: VibeName | null): Song {
  const channelVibes = [...(song.channelVibes ?? [null, null, null, null])] as ChannelVibes;
  channelVibes[channelIndex] = vibe;

  const instruments = song.instruments.map(i => [...i]);
  instruments[channelIndex] = generateInstrumentForChannel(
    vibe ?? song.config.vibe, channelIndex, song.channelSounds?.[channelIndex]
  );

  let next: Song = { ...song, channelVibes, instruments };

  for (const label of next.patternOrder) {
    const { pattern, effects } = regenerateChannel(next, label, channelIndex);
    next = {
      ...next,
      patterns: { ...next.patterns, [label]: pattern },
      patternEffects: { ...next.patternEffects, [label]: effects },
    };
  }

  return next;
}

/**
 * Set (or clear, with null) one channel's timbre override from the sound
 * palette and rebuild only that channel's instrument. The notes are left
 * untouched \u2014 a different sound plays the same part.
 */
export function applyChannelSound(song: Song, channelIndex: number, sound: string | null): Song {
  const channelSounds = [...(song.channelSounds ?? [null, null, null, null])] as ChannelSounds;
  channelSounds[channelIndex] = sound;

  const vibe = song.channelVibes?.[channelIndex] ?? song.config.vibe;
  const instruments = song.instruments.map(i => [...i]);
  instruments[channelIndex] = generateInstrumentForChannel(vibe, channelIndex, sound);

  return { ...song, channelSounds, instruments };
}

// --- CHANNEL EXPANSION ---
// Expands logical 4-channel song to N physical channels for ZzFXM rendering.
// Notes with effects get routed to separate physical channels that use
// instrument variants with the effect baked into ZzFX params.

interface ExpandedSong {
  instruments: number[][];
  patterns: number[][][];
  sequence: number[];
  bpm: number;
  channelMap: number[]; // channelMap[physicalIdx] = logicalIdx (0-3)
}

function expandSong(song: Song): ExpandedSong {
  const hasEffects = song.patternEffects &&
    Object.keys(song.patternEffects).length > 0;

  // Fast path: no effects → return original format
  if (!hasEffects) {
    const patternArrays: number[][][] = [];
    for (const label of song.patternOrder) {
      patternArrays.push([...song.patterns[label]]);
    }
    return {
      instruments: [...song.instruments],
      patterns: patternArrays,
      sequence: song.sequence,
      bpm: song.config.bpm,
      channelMap: [0, 1, 2, 3],
    };
  }

  // Collect all unique effect keys across all patterns
  // Key format: "${logicalCh}_${code}_${value}"
  const effectKeys = new Map<string, { logicalCh: number; effect: NoteEffect }>();

  for (const label of song.patternOrder) {
    const effects = song.patternEffects[label];
    if (!effects) continue;
    for (let ch = 0; ch < 4; ch++) {
      if (!effects[ch]) continue;
      for (const fx of effects[ch]) {
        if (!fx) continue;
        const key = `${ch}_${fx.code}_${fx.value}`;
        if (!effectKeys.has(key)) {
          effectKeys.set(key, { logicalCh: ch, effect: fx });
        }
      }
    }
  }

  // No effects found after scanning → fast path
  if (effectKeys.size === 0) {
    const patternArrays: number[][][] = [];
    for (const label of song.patternOrder) {
      patternArrays.push([...song.patterns[label]]);
    }
    return {
      instruments: [...song.instruments],
      patterns: patternArrays,
      sequence: song.sequence,
      bpm: song.config.bpm,
      channelMap: [0, 1, 2, 3],
    };
  }

  // Build expanded instruments: base 4 + effect variants
  const expandedInstruments = song.instruments.map(i => [...i]);
  const effectInstMap = new Map<string, number>();

  for (const [key, { logicalCh, effect }] of effectKeys) {
    const variant = applyEffect([...song.instruments[logicalCh]], effect);
    effectInstMap.set(key, expandedInstruments.length);
    expandedInstruments.push(variant);
  }

  // Build physical channel layout: 0-3 = clean, 4+ = effect channels
  const channelMap: number[] = [0, 1, 2, 3];
  const effectPhysMap = new Map<string, number>();

  for (const [key, { logicalCh }] of effectKeys) {
    effectPhysMap.set(key, channelMap.length);
    channelMap.push(logicalCh);
  }

  const physicalChannelCount = channelMap.length;

  // Build expanded patterns
  const expandedPatterns: number[][][] = [];

  for (const label of song.patternOrder) {
    const pattern = song.patterns[label];
    const effects = song.patternEffects?.[label];

    // Initialize physical channels: [instrument, pan, ...32 zeros]
    const physPattern: number[][] = [];
    for (let p = 0; p < physicalChannelCount; p++) {
      const logCh = channelMap[p];
      physPattern.push([
        p < 4 ? pattern[logCh][0] : 0,
        pattern[logCh][1],
        ...Array(ROWS).fill(0),
      ]);
    }

    // Route notes to clean or effect channels
    for (let ch = 0; ch < 4; ch++) {
      const channelData = pattern[ch];
      const channelEffects = effects?.[ch];

      for (let row = 0; row < ROWS; row++) {
        const note = channelData[row + 2];
        if (note <= 0) continue;

        const fx = channelEffects?.[row];

        if (fx) {
          const key = `${ch}_${fx.code}_${fx.value}`;
          const physIdx = effectPhysMap.get(key)!;
          const instIdx = effectInstMap.get(key)!;
          physPattern[physIdx][0] = instIdx;
          physPattern[physIdx][row + 2] = note;
        } else {
          physPattern[ch][row + 2] = note;
        }
      }
    }

    expandedPatterns.push(physPattern);
  }

  return {
    instruments: expandedInstruments,
    patterns: expandedPatterns,
    sequence: song.sequence,
    bpm: song.config.bpm,
    channelMap,
  };
}

// Mix N physical stereo buffers back to 4 logical channel buffers
function mixToLogical(
  physicalBuffers: [number[], number[]][],
  channelMap: number[],
): [number[], number[]][] {
  if (physicalBuffers.length === 0) return [];

  const sampleLength = physicalBuffers[0][0].length;
  const logical: [number[], number[]][] = [];
  for (let ch = 0; ch < 4; ch++) {
    logical.push([new Array(sampleLength).fill(0), new Array(sampleLength).fill(0)]);
  }

  for (let p = 0; p < physicalBuffers.length; p++) {
    const logCh = channelMap[p];
    if (logCh === undefined || logCh < 0 || logCh > 3) continue;
    const [pLeft, pRight] = physicalBuffers[p];
    const [lLeft, lRight] = logical[logCh];
    for (let i = 0; i < sampleLength; i++) {
      lLeft[i] += pLeft[i] || 0;
      lRight[i] += pRight[i] || 0;
    }
  }

  return logical;
}

// Convert Song to expanded ZzFXM arrays (for export and rendering)
export function songToZzfxm(song: Song): {
  instruments: number[][];
  patterns: number[][][];
  sequence: number[];
  bpm: number;
} {
  const { channelMap: _, ...rest } = expandSong(song);
  return rest;
}

// Render song to 4 logical stereo channel buffers (for AudioGraph playback)
export function renderSongBuffers(song: Song): [number[], number[]][] {
  const expanded = expandSong(song);

  // Humanize: zzfxm reads a note's fractional part as attenuation, so random
  // per-note velocity costs nothing — add a fraction to each integer note.
  const humanize = Math.max(0, Math.min(30, song.config.humanize ?? 0)) / 100;
  const patterns = humanize > 0
    ? expanded.patterns.map((pattern) =>
        pattern.map((channel) =>
          channel.map((value, idx) =>
            idx >= 2 && value > 0 ? Math.floor(value) + Math.min(0.95, Math.random() * humanize) : value
          )
        )
      )
    : expanded.patterns;

  const swing = Math.max(0, Math.min(30, song.config.swing ?? 0)) / 100;
  const physicalBuffers = zzfxMChannels(
    expanded.instruments, patterns, expanded.sequence, expanded.bpm, undefined, swing
  );
  if (physicalBuffers.length === 0) return [];
  return mixToLogical(physicalBuffers, expanded.channelMap);
}
