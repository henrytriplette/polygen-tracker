export { generateSong, regenerateForVibe, regenerateAllPatterns, regenerateWithNewLength, regeneratePattern, regenerateChannel, regenerateChannelInAllPatterns, addPatternToSong, applyChannelVibe, applyChannelAlgo, applyChannelSound, applyChordsToPattern, applySongStructure, songToZzfxm, renderSongBuffers } from './song';
export { STRUCTURE_OPTIONS, findStructure } from './structures';
export { mutatePattern } from './mutate';
export {
  PARAM_DEFS,
  PARAM_GROUPS,
  SHAPE_NAMES,
  ZZFX_PARAM,
  envelopePoints,
  paramsInGroup,
} from './instrumentParams';
export type { ParamDef, ParamGroup } from './instrumentParams';
export { withSeed, randomSeed } from './random';
export type { StructureOption } from './structures';
export type { ChannelAlgos, LeadAlgo, HarmonyAlgo, BassAlgo, DrumAlgo } from './altPatterns';
export { generateInstruments, generateInstrumentForChannel, CHANNEL_SOUND_OPTIONS } from './instruments';
export { ZZFX, zzfxP, zzfxMChannels, unlockAudio, getAnalyser, floatsToWav } from './zzfx';
export { AudioGraph } from './audioGraph';
export { CHROMATIC, SCALES, getScaleNotes, zzfxmToNoteName, noteToZzfxm, snapNoteToScale } from './scales';
export {
  drumNoteToName,
  drumChannelLabel,
  DRUM_NOTES,
  DRUM_HIT_NOTE,
  DRUM_CHANNELS,
  CHANNELS,
  CHANNEL_COUNT,
  CH_LEAD,
  CH_HARMONY,
  CH_BASS,
  CH_KICK,
  CH_SNARE,
  CH_HAT,
  CH_ARP,
  CH_PAD,
  isDrumChannel,
  channelFamily,
  effectToDisplayString,
} from './types';
export { euclidean } from './euclidean';
export { VIBE_CONFIG, getRandomBpm } from './vibes';
export { generateChordProgression, progressionFromDegrees, randomProgressionDegrees, chordDisplayName, CHORDS_PER_PATTERN } from './chords';
export { applyEffect, generatePatternEffects, generateChannelEffects, FX_VALUES } from './effects';
export { EFFECT_CODES } from './types';
export { generateSongName } from './songNames';
export type {
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
  EffectCode,
  NoteName,
  ScaleName,
  VibeName,
  ZzFXSound,
  ChannelData,
  VibeConfig,
} from './types';
