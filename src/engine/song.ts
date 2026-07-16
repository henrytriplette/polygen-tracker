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
  NoteEffect,
  VibeName,
} from './types';
import { VIBE_CONFIG, getRandomBpm } from './vibes';
import { generateInstruments, generateInstrumentForChannel } from './instruments';
import { generateDrumPattern } from './drums';
import { generateBassPattern } from './bass';
import { generateMelodyPattern } from './melody';
import { generateHarmonyPattern } from './harmony';
import { generateChordProgression } from './chords';
import { generatePatternEffects, generateChannelEffects, applyEffect } from './effects';
import { generateSongName } from './songNames';
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
};

const ROLE_BASS_MULTIPLIER: Record<SectionRole, number> = {
  verse: 1.0,
  contrast: 1.0,
  bridge: 0.7,
  breakdown: 1.0,    // bass stays in breakdowns
  climax: 1.2,
};

// Resolve the vibe a channel should use: its override, or the song's vibe.
function vibeAt(config: SongConfig, channelVibes: ChannelVibes | undefined, ch: number): VibeName {
  return channelVibes?.[ch] ?? config.vibe;
}

function generatePatternForRole(
  config: SongConfig,
  role: SectionRole,
  channelVibes?: ChannelVibes,
): { pattern: Pattern; effects: PatternEffects } {
  const melodyVibe = vibeAt(config, channelVibes, 0);
  const harmonyVibe = vibeAt(config, channelVibes, 1);
  const bassVibe = vibeAt(config, channelVibes, 2);
  const drumVibe = vibeAt(config, channelVibes, 3);

  // Chord progression flavor follows the harmony channel's vibe — the key and
  // scale stay global, so every channel remains harmonically locked.
  const progression = generateChordProgression(harmonyVibe, config.key, config.scale);

  // Drums always play (backbone of every section)
  const { channelData: drumChannel, kickPattern } = generateDrumPattern(drumVibe);

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
    const bassChannel = generateBassPattern(
      config.key, config.scale, kickPattern,
      scaledBassDensity, bassVibe, progression
    );
    const pattern = [silentChannel, silentChannel, bassChannel, drumChannel] as Pattern;
    const effects = generatePatternEffects(pattern, config, role, channelVibes);
    return { pattern, effects };
  }

  // Melody
  const melodyChannel = generateMelodyPattern(
    config.key, config.scale, melodyDensity, progression
  );

  // Bass
  const bassChannel = generateBassPattern(
    config.key, config.scale, kickPattern,
    scaledBassDensity, bassVibe, progression
  );

  // Harmony
  const melodyNotes = melodyChannel.slice(2);
  const harmonyChannel = generateHarmonyPattern(
    config.key, config.scale, melodyNotes, progression
  );

  // Bridge: thin out harmony further (50% chance to silence each hit)
  if (role === 'bridge') {
    for (let i = 2; i < harmonyChannel.length; i++) {
      if (harmonyChannel[i] > 0 && Math.random() < 0.5) {
        harmonyChannel[i] = 0;
      }
    }
  }

  const pattern = [melodyChannel, harmonyChannel, bassChannel, drumChannel] as Pattern;
  const effects = generatePatternEffects(pattern, config, role, channelVibes);
  return { pattern, effects };
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateSong(config?: Partial<SongConfig>, channelVibes?: ChannelVibes): Song {
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
  const instruments = [0, 1, 2, 3].map((ch) =>
    generateInstrumentForChannel(vibes[ch] ?? vibe, ch)
  );

  // Pick a structure template for this vibe + length
  const template = pick(vibeConfig.structures[length]);

  // Generate unique patterns, each with its assigned role
  const patterns: Record<PatternLabel, Pattern> = {} as Record<PatternLabel, Pattern>;
  const patternRoles: Record<PatternLabel, SectionRole> = {} as Record<PatternLabel, SectionRole>;
  const patternEffects: Record<PatternLabel, PatternEffects> = {} as Record<PatternLabel, PatternEffects>;
  const patternOrder: PatternLabel[] = [];

  for (let i = 0; i < template.roles.length; i++) {
    const label = PATTERN_LABELS[i];
    const role = template.roles[i];
    const { pattern, effects } = generatePatternForRole(fullConfig, role, vibes);
    patterns[label] = pattern;
    patternRoles[label] = role;
    patternEffects[label] = effects;
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
    song.channelVibes
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

  for (const label of song.patternOrder) {
    const role = song.patternRoles[label] ?? 'verse';
    const { pattern, effects } = generatePatternForRole(newConfig, role, song.channelVibes);
    patterns[label] = pattern;
    patternEffects[label] = effects;
  }

  return {
    ...song,
    config: newConfig,
    patterns,
    patternEffects,
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
  const vibeConfig = VIBE_CONFIG[newConfig.vibe];
  const template = pick(vibeConfig.structures[newLength]);

  const patterns: Record<PatternLabel, Pattern> = {} as Record<PatternLabel, Pattern>;
  const patternRoles: Record<PatternLabel, SectionRole> = {} as Record<PatternLabel, SectionRole>;
  const patternEffects: Record<PatternLabel, PatternEffects> = {} as Record<PatternLabel, PatternEffects>;
  const patternOrder: PatternLabel[] = [];

  for (let i = 0; i < template.roles.length; i++) {
    const label = PATTERN_LABELS[i];
    const role = template.roles[i];
    const { pattern, effects } = generatePatternForRole(newConfig, role, song.channelVibes);
    patterns[label] = pattern;
    patternRoles[label] = role;
    patternEffects[label] = effects;
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
  };
}

export function regeneratePattern(
  song: Song,
  patternLabel: PatternLabel
): { pattern: Pattern; effects: PatternEffects } {
  const role = song.patternRoles[patternLabel] ?? 'verse';
  return generatePatternForRole(song.config, role, song.channelVibes);
}

export function regenerateChannel(
  song: Song,
  patternLabel: PatternLabel,
  channelIndex: number
): { pattern: Pattern; effects: PatternEffects } {
  const pattern = [...song.patterns[patternLabel]] as Pattern;
  const role = song.patternRoles[patternLabel] ?? 'verse';
  const channelVibe = vibeAt(song.config, song.channelVibes, channelIndex);
  const channelVibeConfig = VIBE_CONFIG[channelVibe];

  // Progression flavor follows the harmony channel's vibe, matching
  // generatePatternForRole so regenerated channels stay stylistically aligned.
  const progression = generateChordProgression(
    vibeAt(song.config, song.channelVibes, 1), song.config.key, song.config.scale
  );

  const melodyMult = ROLE_MELODY_MULTIPLIER[role];
  const bassMult = ROLE_BASS_MULTIPLIER[role];

  switch (channelIndex) {
    case 0: {
      if (role === 'breakdown') {
        pattern[0] = [0, 0, ...Array(ROWS).fill(0)];
      } else {
        pattern[0] = generateMelodyPattern(
          song.config.key, song.config.scale,
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
        pattern[1] = generateHarmonyPattern(
          song.config.key, song.config.scale, melodyNotes, progression
        );
      }
      break;
    }
    case 2: {
      const kickPattern = pattern[3].slice(2).map(n => n > 0 ? 1 : 0);
      pattern[2] = generateBassPattern(
        song.config.key, song.config.scale, kickPattern,
        [
          Math.round(channelVibeConfig.bassDensity[0] * bassMult),
          Math.round(channelVibeConfig.bassDensity[1] * bassMult),
        ],
        channelVibe, progression
      );
      break;
    }
    case 3: {
      const { channelData } = generateDrumPattern(channelVibe);
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
 * Set (or clear, with null) one channel's vibe override. Regenerates that
 * channel's instrument and its notes in every pattern so the new style is
 * immediately audible; the other channels are untouched.
 */
export function applyChannelVibe(song: Song, channelIndex: number, vibe: VibeName | null): Song {
  const channelVibes = [...(song.channelVibes ?? [null, null, null, null])] as ChannelVibes;
  channelVibes[channelIndex] = vibe;

  const instruments = song.instruments.map(i => [...i]);
  instruments[channelIndex] = generateInstrumentForChannel(
    vibe ?? song.config.vibe, channelIndex
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
  const physicalBuffers = zzfxMChannels(
    expanded.instruments, expanded.patterns, expanded.sequence, expanded.bpm
  );
  if (physicalBuffers.length === 0) return [];
  return mixToLogical(physicalBuffers, expanded.channelMap);
}
