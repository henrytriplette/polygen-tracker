import {
  EffectCode, NoteEffect, ChannelEffects, PatternEffects,
  ZzFXSound, SongConfig, SectionRole, VibeName, Pattern,
  ChannelFamily, CHANNEL_COUNT, CH_KICK, CH_SNARE, CH_HAT, RHYTHM_PERIOD,
  channelFamily, isDrumChannel,
} from './types';
import { VIBE_CONFIG } from './vibes';

// --- EFFECT APPLICATION ---
// Maps effect codes to ZzFX parameter modifications.
// ZzFX params: [volume, randomness, frequency, attack, sustain, release, shape,
//   shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime,
//   noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo]

export function applyEffect(baseParams: ZzFXSound, effect: NoteEffect): ZzFXSound {
  const p = [...baseParams];
  const v = effect.value;

  switch (effect.code) {
    case 'SU': // Slide Up — retro sweep (~1-2 semitone bend)
      p[8] = (v / 255) * 0.8;
      break;
    case 'SD': // Slide Down
      p[8] = -(v / 255) * 0.8;
      break;
    case 'VB': { // Vibrato — XY: X=speed(1-F), Y=depth(1-F)
      const speed = (v >> 4) || 1;
      const depth = (v & 0xF) || 1;
      p[12] = 0.05 + (16 - speed) * 0.02; // repeatTime in seconds (3-14 Hz)
      p[19] = (depth / 15) * 0.5;          // tremolo depth for volume wobble
      break;
    }
    case 'DT': // Duty Cycle — pulse width presets
      p[7] = v === 1 ? 0.25 : v === 2 ? 0.5 : 1.0;
      break;
    case 'ST': { // Staccato — shorten envelope
      const factor = 1 - (v / 255) * 0.85;
      p[4] *= factor; // sustain
      p[5] *= factor; // release
      break;
    }
    case 'PD': // Pitch Drop — quick downward sweep
      p[10] = -(v / 255) * 40;              // pitchJump (scaled for ~1-2 semitone drop)
      p[11] = 0.005 + (v / 255) * 0.02;     // pitchJumpTime
      break;
    case 'BC': // Bit Crush — lo-fi crunch (keep effective SR above ~1kHz)
      p[15] = (v / 255) * 1;
      break;
    case 'TR': { // Tremolo — volume wobble, XY format
      const tSpeed = (v >> 4) || 1;
      const tDepth = (v & 0xF) || 1;
      p[12] = 0.04 + (16 - tSpeed) * 0.015; // repeatTime in seconds (3.5-18 Hz)
      p[19] = (tDepth / 15) * 0.7;
      break;
    }
  }

  return p;
}

// --- GENERATION CONSTANTS ---

// Single fixed value per effect — consistency over variety.
// Using the middle palette value keeps things musical without being extreme.
// Exported as the default value when the user places an effect by hand.
export const FX_VALUES: Record<EffectCode, number> = {
  SU: 0x60,  // ~1.5 semitone slide up
  SD: 0x60,  // ~1.5 semitone slide down
  VB: 0x36,  // ~4 Hz vibrato, moderate depth
  DT: 0x02,  // 50% duty (most audible change)
  ST: 0x80,  // half-length note
  PD: 0x60,  // ~1 semitone pitch drop
  BC: 0x18,  // subtle crunch (~1575 Hz effective SR)
  TR: 0x46,  // ~5 Hz tremolo, moderate depth
};

// Drums need a heavier pitch drop for audible thump
const DRUM_PD_VALUE = 0xA0;

// Which effects each channel family can use
const FAMILY_FX_POOLS: Record<ChannelFamily, EffectCode[]> = {
  lead: ['SU', 'SD', 'VB', 'DT', 'ST', 'PD'], // full expression palette
  harmony: ['VB', 'DT', 'ST'],                 // subtle, don't compete
  bass: ['SD', 'ST', 'PD'],                    // grounded
  drums: ['PD', 'BC'],                         // punch kicks, crunch snares
};

// Index into the per-vibe FX tables below (which stay 4 entries wide):
// every channel maps onto one of the four families.
const FAMILY_FX_INDEX: Record<ChannelFamily, number> = {
  lead: 0,
  harmony: 1,
  bass: 2,
  drums: 3,
};

// Per-vibe: which effect does each channel favor?
// Ranked by preference — index 0 is the primary, index 1 is secondary.
// The generator picks the primary for most sections, adds secondary in climax.
const VIBE_CHANNEL_FX: Record<VibeName, EffectCode[][]> = {
  adventure: [
    ['VB', 'SU'],  // lead: vibrato on held notes, slide-up at phrase starts
    ['VB'],        // harmony: gentle vibrato
    ['SD'],        // bass: slide-down for resolution
    ['PD'],        // drums: punchy kicks
  ],
  battle: [
    ['ST', 'PD'],  // lead: staccato punch, pitch drops for aggression
    ['ST'],        // harmony: staccato for rhythmic drive
    ['ST', 'PD'],  // bass: staccato hits, pitch drops on roots
    ['PD', 'BC'],  // drums: punchy kicks + crunchy snares
  ],
  dungeon: [
    ['VB', 'SD'],  // lead: eerie vibrato, downward slides
    ['VB'],        // harmony: atmospheric vibrato
    ['SD'],        // bass: descending slides
    ['PD'],        // drums: subtle kick punch
  ],
  titleScreen: [
    ['VB', 'SU'],  // lead: warm vibrato, gentle slide-ups
    ['VB'],        // harmony: soft vibrato
    ['SD'],        // bass: subtle resolution slides
    ['PD'],        // drums: gentle kick punch
  ],
  boss: [
    ['ST', 'SU'],  // lead: staccato punch, aggressive slide-ups
    ['DT', 'ST'],  // harmony: duty cycle grit, staccato punch
    ['ST', 'PD'],  // bass: staccato hits, pitch drops on roots
    ['PD', 'BC'],  // drums: heavy kick punch + crushed snares
  ],
  synthwave: [
    ['VB', 'SU'],  // lead: singing vibrato, scoops into held notes
    ['VB'],        // harmony: slow pad shimmer
    ['SD'],        // bass: resolution slides
    ['PD'],        // drums: punchy gated kicks
  ],
  house: [
    ['ST', 'SU'],  // lead: tight stabs, filter-sweep-style rises
    ['ST'],        // harmony: choppy chord stabs
    ['ST'],        // bass: pumping staccato
    ['PD', 'BC'],  // drums: kick thump + crunchy claps
  ],
  lofi: [
    ['VB', 'SD'],  // lead: wow/flutter warble, lazy falls
    ['VB'],        // harmony: tape-warble pads
    ['SD'],        // bass: relaxed slides down
    ['BC'],        // drums: dusty crunch
  ],
  funk: [
    ['ST', 'SU'],  // lead: clipped clav hits, grace-note scoops
    ['ST'],        // harmony: tight rhythm chops
    ['ST', 'SD'],  // bass: percussive pocket, slide-downs
    ['PD', 'BC'],  // drums: punchy kicks, cracking snares
  ],
  punk: [
    ['ST', 'PD'],  // lead: shouted staccato, dive-bomb drops
    ['ST'],        // harmony: chugging power chords
    ['ST'],        // bass: relentless downpicked eighths
    ['PD', 'BC'],  // drums: slammed kicks + blown-out snares
  ],
  techno: [
    ['ST', 'SU'],  // lead: clipped stabs, filter-rise gestures
    ['ST'],        // harmony: hypnotic chopped chords
    ['ST'],        // bass: tight machine pulse
    ['PD', 'BC'],  // drums: punched kicks, gritty percussion
  ],
  dub: [
    ['VB', 'SD'],  // lead: tape-wobble melodica, lazy falls
    ['VB'],        // harmony: swimming skank chords
    ['SD'],        // bass: sliding heavyweight lines
    ['PD'],        // drums: deep kick bloom
  ],
  idm: [
    ['PD', 'DT'],  // lead: pitch mangling, timbre flips
    ['DT'],        // harmony: waveform morphs
    ['ST', 'PD'],  // bass: chopped, bent low end
    ['BC', 'PD'],  // drums: bit-crushed hits, warped kicks
  ],
  hardcore: [
    ['PD', 'SU'],  // lead: sirens and dive-bombs
    ['DT', 'ST'],  // harmony: hoover grit, chopped stabs
    ['ST', 'PD'],  // bass: hammering staccato
    ['PD', 'BC'],  // drums: overdriven kick punch + crushed snares
  ],
  dnb: [
    ['VB', 'SU'],  // lead: liquid shimmer, rises
    ['VB'],        // harmony: pad movement
    ['SD', 'ST'],  // bass: reese slides, chops
    ['PD', 'BC'],  // drums: kick weight + crunched break
  ],
};

// How many effects per channel per pattern, by role.
// [lead, harmony, bass] — drums always 0.
// These are MAXIMUMS — actual count depends on available structural positions.
const ROLE_BUDGETS: Record<SectionRole, [number, number, number, number]> = {
  verse:     [2, 1, 1, 2],  // subtle enhancement, a couple punched kicks
  contrast:  [2, 1, 1, 2],  // similar to verse
  bridge:    [1, 0, 0, 1],  // very sparse, breathing room
  breakdown: [0, 0, 0, 2],  // drums only section — let kicks punch
  climax:    [4, 2, 2, 4],  // peak expression, secondary effect unlocked
  chorus:    [3, 2, 2, 3],  // hook section — expressive but controlled
  refrain:   [2, 1, 0, 2],  // lead hook gets color, backing stays plain
};

// --- STRUCTURAL POSITION FINDING ---

// Each effect type has preferred structural positions in the music.
// This maps effect codes to the kinds of positions they sound best at.
type PositionType = 'phraseStart' | 'phraseEnd' | 'heldNote';

const EFFECT_POSITIONS: Record<EffectCode, PositionType[]> = {
  SU: ['phraseStart'],            // scoop into the note
  SD: ['phraseEnd'],              // slide down to rest
  VB: ['heldNote', 'phraseStart'], // sustain wobble, or opening note color
  DT: ['phraseStart'],            // timbre shift at phrase boundary
  ST: ['phraseEnd', 'heldNote'],  // cut short before next phrase
  PD: ['phraseStart'],            // dramatic entrance
  BC: ['phraseStart'],            // crunch accent on downbeat
  TR: ['heldNote'],               // volume wobble on sustained notes
};

// Each drum channel has one kind of hit now, so the preferred effect is
// chosen per channel rather than per note value.
const DRUM_CHANNEL_EFFECT: Record<number, EffectCode> = {
  [CH_KICK]: 'PD',   // pitch drop punches kicks
  [CH_SNARE]: 'BC',  // bit crush crunches snares
  [CH_HAT]: 'BC',    // light crunch on hats
};

function classifyPositions(notes: number[]): Record<PositionType, number[]> {
  const phraseStart: number[] = [];
  const phraseEnd: number[] = [];
  const heldNote: number[] = [];

  const length = notes.length;
  for (let row = 0; row < length; row++) {
    if (notes[row] <= 0) continue;

    const phrasePos = row % RHYTHM_PERIOD;
    const nextIsRest = row + 1 >= length || notes[row + 1] <= 0;

    if (phrasePos === 0) phraseStart.push(row);
    if (phrasePos >= 6 && nextIsRest) phraseEnd.push(row);
    if (nextIsRest && phrasePos < 6) heldNote.push(row);
  }

  return { phraseStart, phraseEnd, heldNote };
}

// Find the best positions for an effect, preferring mirrored pairs
// (phrase 1 + phrase 3, or phrase 2 + phrase 4) for ABAB consistency.
function selectPositions(
  candidates: number[],
  notes: number[],
  budget: number,
): number[] {
  if (candidates.length === 0 || budget <= 0) return [];

  const result: number[] = [];

  // First pass: find mirrored pairs (row N and its counterpart half a pattern
  // away). Placing effects at both creates the musical repetition we want.
  const half = Math.max(1, Math.floor(notes.length / 2));
  const used = new Set<number>();
  for (const pos of candidates) {
    if (used.has(pos)) continue;
    const mirror = pos < half ? pos + half : pos - half;
    if (candidates.includes(mirror) && notes[mirror] > 0 && !used.has(mirror)) {
      if (result.length + 2 <= budget) {
        result.push(pos, mirror);
        used.add(pos);
        used.add(mirror);
      }
    }
    if (result.length >= budget) break;
  }

  // Second pass: fill remaining budget with unpaired positions
  for (const pos of candidates) {
    if (result.length >= budget) break;
    if (!used.has(pos)) {
      result.push(pos);
      used.add(pos);
    }
  }

  return result;
}

// --- GENERATION ---

export function generateChannelEffects(
  channelIndex: number,
  notes: number[],
  config: SongConfig,
  role: SectionRole,
  vibeOverride?: VibeName,
): ChannelEffects {
  const rows = notes.length;
  if (channelIndex >= CHANNEL_COUNT) return Array(rows).fill(null);
  const family = channelFamily(channelIndex);
  const pool = FAMILY_FX_POOLS[family];
  if (!pool || pool.length === 0) return Array(rows).fill(null);

  const budget = ROLE_BUDGETS[role][FAMILY_FX_INDEX[family]] ?? 0;
  if (budget <= 0) return Array(rows).fill(null);

  // Get this vibe's ranked effects for this channel's family
  const vibePrefs = VIBE_CHANNEL_FX[vibeOverride ?? config.vibe][FAMILY_FX_INDEX[family]];
  if (!vibePrefs || vibePrefs.length === 0) return Array(rows).fill(null);

  // Each drum channel places its own effect on its strongest hits
  if (isDrumChannel(channelIndex)) {
    return generateDrumEffects(channelIndex, notes, budget);
  }

  // Primary effect: always the top-ranked preference
  const primaryEffect = vibePrefs[0];
  // Secondary effect: only used in climax, and only if budget allows
  const secondaryEffect = vibePrefs.length > 1 ? vibePrefs[1] : null;
  const useSecondary = secondaryEffect && role === 'climax' && budget >= 3;

  // Classify all note positions
  const positions = classifyPositions(notes);

  // Find candidates for the primary effect
  const primaryTypes = EFFECT_POSITIONS[primaryEffect];
  let primaryCandidates: number[] = [];
  for (const pType of primaryTypes) {
    primaryCandidates = primaryCandidates.concat(positions[pType]);
  }
  // Deduplicate and sort
  primaryCandidates = [...new Set(primaryCandidates)].sort((a, b) => a - b);

  // Allocate budget: primary gets most, secondary gets 1-2 if used
  const secondaryBudget = useSecondary ? Math.min(2, Math.floor(budget / 3)) : 0;
  const primaryBudget = budget - secondaryBudget;

  // Select positions for primary effect
  const primaryPositions = selectPositions(primaryCandidates, notes, primaryBudget);

  // Select positions for secondary effect (from different position types)
  let secondaryPositions: number[] = [];
  if (useSecondary && secondaryEffect && secondaryBudget > 0) {
    const secondaryTypes = EFFECT_POSITIONS[secondaryEffect];
    let secondaryCandidates: number[] = [];
    for (const pType of secondaryTypes) {
      secondaryCandidates = secondaryCandidates.concat(positions[pType]);
    }
    // Exclude positions already used by primary
    const usedSet = new Set(primaryPositions);
    secondaryCandidates = [...new Set(secondaryCandidates)]
      .filter(p => !usedSet.has(p))
      .sort((a, b) => a - b);
    secondaryPositions = selectPositions(secondaryCandidates, notes, secondaryBudget);
  }

  // Build the effects array
  const effects: (NoteEffect | null)[] = Array(rows).fill(null);

  for (const pos of primaryPositions) {
    effects[pos] = { code: primaryEffect, value: FX_VALUES[primaryEffect] };
  }
  for (const pos of secondaryPositions) {
    effects[pos] = { code: secondaryEffect!, value: FX_VALUES[secondaryEffect!] };
  }

  return effects;
}

// Drum-specific effect placement: target kicks with PD, snares with BC.
// Prefers downbeat kicks (rows 0, 16) and backbeat snares (rows 8, 24)
// for musical consistency. Uses mirroring (row N ↔ row N±16).
// One drum per channel: place that channel's effect on its strongest hits
// (downbeats first), mirroring rows N and N±16 for ABAB consistency.
function generateDrumEffects(
  channelIndex: number,
  notes: number[],
  budget: number,
): ChannelEffects {
  const effects: (NoteEffect | null)[] = Array(notes.length).fill(null);
  const code = DRUM_CHANNEL_EFFECT[channelIndex];
  if (!code) return effects;

  // Hats are decoration — give them at most one accent
  const effectiveBudget = channelIndex === CH_HAT ? Math.min(1, budget) : budget;
  if (effectiveBudget <= 0) return effects;

  const hits: number[] = [];
  for (let row = 0; row < notes.length; row++) if (notes[row] > 0) hits.push(row);

  const sorted = [...hits].sort((a, b) => {
    const aDown = a % 8 === 0 ? 0 : 1;
    const bDown = b % 8 === 0 ? 0 : 1;
    return aDown - bDown || a - b;
  });

  const value = code === 'PD' ? DRUM_PD_VALUE : FX_VALUES[code];
  for (const pos of selectPositions(sorted, notes, effectiveBudget)) {
    effects[pos] = { code, value };
  }

  return effects;
}

export function generatePatternEffects(
  pattern: Pattern,
  config: SongConfig,
  role: SectionRole,
  channelVibes?: (VibeName | null)[],
): PatternEffects {
  return Array.from({ length: CHANNEL_COUNT }, (_, ch) =>
    generateChannelEffects(ch, pattern[ch].slice(2), config, role, channelVibes?.[ch] ?? undefined)
  );
}
