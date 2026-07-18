import { CHANNELS, CHANNEL_COUNT, CH_HAT, CH_KICK, CH_SNARE, VibeName, ZzFXSound } from './types';

// ZzFX params: [volume, randomness, frequency, attack, sustain, release, shape,
//   shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime,
//   noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo]
//
// Shape: 0=sin, 1=triangle, 2=saw, 3=tan, 4=noise(sin(t^3)), 5=square/pulse
//
// Instrument generation strategy:
//   1. Pick a base archetype for the channel role (lead/harmony/bass/drums)
//   2. Apply 0-2 traits weighted by vibe (vibrato, staccato, crushed, etc.)
//   3. Add micro-randomness so no two regens sound identical
//
// This gives (archetypes × trait combos × randomness) = hundreds of unique sounds
// while staying musically appropriate per vibe.

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// --- BASE ARCHETYPES ---
// Each is a starting point for a channel role. Frequency (idx 2) is always
// 261.63 (C4) — zzfxM transposes via note values at render time.

type Archetype = {
  name: string;
  params: ZzFXSound;
};

//  idx:  0     1      2       3      4      5      6   7     8    9    10   11   12   13   14   15   16   17    18    19
//       vol  rand   freq    atk    sus    rel   shp  crv   sld  dSld pJmp pJT  rpt  nse  mod  bc   dly  sVol  dec   trm

const LEAD_ARCHETYPES: Archetype[] = [
  { name: 'classic-square',
    params: [0.5, 0.01, 261.63, 0.005, 0.2,  0.08, 5, 1.0,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9,  0.02, 0] },
  { name: 'thin-pulse',
    params: [0.5, 0.01, 261.63, 0.005, 0.2,  0.08, 5, 0.5,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9,  0.02, 0] },
  { name: 'nasal-pulse',
    params: [0.5, 0.01, 261.63, 0.005, 0.2,  0.08, 5, 0.25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.85, 0.02, 0] },
  { name: 'bright-saw',
    params: [0.4, 0.01, 261.63, 0.005, 0.18, 0.08, 2, 1.0,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0.85, 0.02, 0] },
  { name: 'soft-sine',
    params: [0.45,0.01, 261.63, 0.01,  0.22, 0.1,  0, 1.0,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0.8,  0.02, 0] },
];

const HARMONY_ARCHETYPES: Archetype[] = [
  { name: 'thin-pulse',
    params: [0.22, 0.01, 261.63, 0.005, 0.12, 0.08, 5, 0.4,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7,  0.02, 0] },
  { name: 'soft-saw',
    params: [0.2,  0.01, 261.63, 0.01,  0.1,  0.08, 2, 0.8,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6,  0.02, 0] },
  { name: 'triangle-pad',
    params: [0.2,  0.01, 261.63, 0.02,  0.18, 0.12, 1, 1.0,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0.55, 0.03, 0] },
  { name: 'sine-pad',
    params: [0.18, 0.01, 261.63, 0.02,  0.2,  0.12, 0, 1.0,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5,  0.03, 0] },
  { name: 'buzzy-narrow',
    params: [0.25, 0.01, 261.63, 0.005, 0.1,  0.06, 5, 0.2,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7,  0.02, 0] },
];

const BASS_ARCHETYPES: Archetype[] = [
  { name: 'triangle',
    params: [0.6, 0.01, 261.63, 0,     0.15, 0.06, 1, 1.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.85, 0.02, 0] },
  { name: 'square',
    params: [0.5, 0.01, 261.63, 0,     0.14, 0.05, 5, 1.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9,  0.02, 0] },
  { name: 'saw',
    params: [0.45,0.01, 261.63, 0,     0.12, 0.05, 2, 0.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.85, 0.02, 0] },
  { name: 'sub-sine',
    params: [0.65,0.01, 261.63, 0,     0.18, 0.08, 0, 1.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.8,  0.02, 0] },
];

const DRUM_ARCHETYPES: Archetype[] = [
  { name: 'standard',
    params: [0.8, 0, 350, 0, 0.01,  0.08, 4, 1.0, -8,  0, 0, 0, 0, 0.5,  0, 0,   0, 0.05, 0.04, 0] },
  { name: 'tight',
    params: [0.85,0, 380, 0, 0.005, 0.05, 4, 1.0, -10, 0, 0, 0, 0, 0.45, 0, 0,   0, 0.03, 0.03, 0] },
  { name: 'boomy',
    params: [0.9, 0, 300, 0, 0.02,  0.12, 4, 1.0, -6,  0, 0, 0, 0, 0.55, 0, 0,   0, 0.08, 0.05, 0] },
  { name: 'crushed',
    params: [0.85,0, 400, 0, 0.012, 0.09, 4, 1.0, -12, 0, 0, 0, 0, 0.6,  0, 1.5, 0, 0.05, 0.04, 0] },
  { name: 'metallic',
    params: [0.7, 0, 420, 0, 0.008, 0.07, 4, 1.0, -4,  0, 0, 0, 0, 0.3,  0, 0,   0, 0.04, 0.03, 0] },
];

// --- TRAITS ---
// Each trait mutates a ZzFXSound in-place. Designed to be composable —
// applying 2 traits produces a sensible sound, not garbage.

type TraitName =
  | 'vibrato' | 'fastVibrato' | 'staccato' | 'legato'
  | 'pitchBend' | 'pitchDrop' | 'crushed' | 'echoed'
  | 'wobbly' | 'tremolo' | 'clean' | 'aggressive' | 'soft';

type TraitFn = (p: ZzFXSound) => void;

const TRAITS: Record<TraitName, TraitFn> = {
  // Vibrato — slow volume wobble, classic chiptune life
  vibrato: (p) => {
    p[12] = pick([0.2, 0.25, 0.3]);  // repeatTime in seconds (3-5 Hz)
    p[19] = randRange(0.15, 0.35);   // tremolo amount
  },
  // Faster vibrato — more intense, nervous
  fastVibrato: (p) => {
    p[12] = pick([0.08, 0.1, 0.14]); // repeatTime in seconds (7-12 Hz)
    p[19] = randRange(0.2, 0.45);
  },
  // Staccato — short, punchy notes
  staccato: (p) => {
    p[4] *= randRange(0.3, 0.5);    // sustain
    p[5] *= randRange(0.4, 0.6);    // release
    p[17] = Math.min(1, (p[17] ?? 1) + 0.1); // sustainVolume up (louder during short time)
  },
  // Legato — long, flowing notes
  legato: (p) => {
    p[3] = Math.max(p[3], 0.01);    // gentle attack
    p[4] *= randRange(1.5, 2.2);    // long sustain
    p[5] *= randRange(1.3, 1.8);    // long release
  },
  // Pitch bend up on attack — notes "scoop" into pitch
  pitchBend: (p) => {
    p[8] = randRange(1, 4);          // slide up
  },
  // Pitch drop — notes start high, fall into pitch (percussive feel)
  pitchDrop: (p) => {
    p[10] = randRange(-5, -15);      // pitchJump down
    p[11] = randRange(0.01, 0.03);   // pitchJumpTime (quick)
  },
  // Bit crush — lo-fi crunch (keep values mild, high values sound broken)
  crushed: (p) => {
    p[15] = pick([0.3, 0.5, 0.7, 1]);  // bitCrush
  },
  // Echo/delay — adds depth and space
  echoed: (p) => {
    p[16] = randRange(0.02, 0.06);   // delay
  },
  // Wobbly — subtle frequency modulation, adds movement without bubble/whistle
  wobbly: (p) => {
    p[14] = randRange(0.1, 0.4);     // modulation (low values = texture, high = bubble)
  },
  // Tremolo — volume wobble, rhythmic texture
  tremolo: (p) => {
    p[12] = pick([0.12, 0.18, 0.25]); // repeatTime in seconds (4-8 Hz)
    p[19] = randRange(0.3, 0.6);
  },
  // Clean — no effects, pure tone. Explicitly zeroes FX params.
  clean: (p) => {
    p[8] = 0; p[9] = 0; p[10] = 0; p[11] = 0;
    p[14] = 0; p[15] = 0; p[16] = 0; p[19] = 0;
  },
  // Aggressive — louder, tighter, harder
  aggressive: (p) => {
    p[0] *= randRange(1.1, 1.35);    // volume boost
    p[3] = 0;                        // instant attack
    p[18] *= randRange(0.5, 0.8);    // shorter decay
  },
  // Soft — quieter, gentler, more air
  soft: (p) => {
    p[0] *= randRange(0.65, 0.8);
    p[3] = Math.max(p[3], randRange(0.01, 0.025));
    p[17] = Math.max(0, (p[17] ?? 1) - randRange(0.1, 0.2));
  },
};

// --- VIBE TRAIT WEIGHTS ---
// Per-channel trait pools. Each vibe defines which traits are likely
// and how many to apply (traitCount range).

type ChannelRole = 'lead' | 'harmony' | 'bass' | 'drums';

interface VibeTraitConfig {
  archetypeWeights: number[];    // weights for picking archetype (parallel to archetype array)
  traitPool: TraitName[];        // available traits
  traitWeights: number[];        // parallel weights
  traitCount: [number, number];  // [min, max] traits to apply
}

const VIBE_TRAITS: Record<VibeName, Record<ChannelRole, VibeTraitConfig>> = {
  adventure: {
    lead: {
      archetypeWeights: [4, 2, 1, 1, 1],  // favor classic square
      traitPool:    ['clean', 'vibrato', 'pitchBend', 'staccato', 'echoed'],
      traitWeights: [3,       3,         1,           1,           1],
      traitCount: [0, 2],
    },
    harmony: {
      archetypeWeights: [3, 2, 2, 1, 1],
      traitPool:    ['clean', 'vibrato', 'legato', 'soft'],
      traitWeights: [3,       2,         2,        2],
      traitCount: [0, 1],
    },
    bass: {
      archetypeWeights: [4, 2, 1, 1],  // favor triangle
      traitPool:    ['clean', 'staccato', 'pitchBend'],
      traitWeights: [4,       2,          1],
      traitCount: [0, 1],
    },
    drums: {
      archetypeWeights: [4, 2, 1, 1, 1],
      traitPool:    ['clean', 'aggressive'],
      traitWeights: [3,       1],
      traitCount: [0, 1],
    },
  },

  battle: {
    lead: {
      archetypeWeights: [3, 3, 1, 2, 0],  // square + pulse, some saw, no sine
      traitPool:    ['aggressive', 'staccato', 'crushed', 'fastVibrato', 'pitchDrop', 'clean'],
      traitWeights: [3,            3,          1,         1,             1,           2],
      traitCount: [1, 2],
    },
    harmony: {
      archetypeWeights: [1, 3, 0, 0, 3],  // saw + buzzy
      traitPool:    ['aggressive', 'staccato', 'clean', 'fastVibrato'],
      traitWeights: [3,            2,          3,       1],
      traitCount: [0, 2],
    },
    bass: {
      archetypeWeights: [2, 3, 2, 0],  // punch: square > triangle > saw
      traitPool:    ['aggressive', 'staccato', 'clean'],
      traitWeights: [3,            3,          2],
      traitCount: [1, 2],
    },
    drums: {
      archetypeWeights: [2, 3, 1, 2, 1],  // tight favored, less crushed archetype
      traitPool:    ['aggressive', 'clean'],
      traitWeights: [2,            3],
      traitCount: [0, 1],
    },
  },

  dungeon: {
    lead: {
      archetypeWeights: [1, 1, 0, 0, 4],  // favor sine, some square
      traitPool:    ['legato', 'vibrato', 'echoed', 'soft', 'tremolo'],
      traitWeights: [3,        2,         2,        2,      1],
      traitCount: [1, 2],
    },
    harmony: {
      archetypeWeights: [1, 0, 3, 3, 0],  // triangle + sine pads
      traitPool:    ['legato', 'echoed', 'soft', 'tremolo'],
      traitWeights: [3,        2,        2,      1],
      traitCount: [1, 2],
    },
    bass: {
      archetypeWeights: [3, 0, 0, 3],  // triangle + sub-sine
      traitPool:    ['legato', 'soft', 'echoed'],
      traitWeights: [3,        2,      1],
      traitCount: [0, 2],
    },
    drums: {
      archetypeWeights: [2, 1, 3, 1, 2],  // boomy + standard
      traitPool:    ['soft', 'echoed'],
      traitWeights: [3,      2],
      traitCount: [0, 1],
    },
  },

  titleScreen: {
    lead: {
      archetypeWeights: [3, 1, 0, 1, 3],  // square + sine (warm, welcoming)
      traitPool:    ['clean', 'vibrato', 'legato', 'soft', 'echoed'],
      traitWeights: [3,       2,         2,        1,      1],
      traitCount: [0, 1],
    },
    harmony: {
      archetypeWeights: [2, 2, 2, 2, 0],  // any soft archetype
      traitPool:    ['clean', 'legato', 'soft', 'vibrato'],
      traitWeights: [3,       2,        2,      1],
      traitCount: [0, 1],
    },
    bass: {
      archetypeWeights: [4, 1, 0, 2],  // triangle + sub
      traitPool:    ['clean', 'legato', 'soft'],
      traitWeights: [3,       2,        1],
      traitCount: [0, 1],
    },
    drums: {
      archetypeWeights: [3, 2, 1, 0, 2],  // standard, light
      traitPool:    ['clean', 'soft'],
      traitWeights: [3,       2],
      traitCount: [0, 1],
    },
  },

  boss: {
    lead: {
      archetypeWeights: [2, 3, 2, 3, 0],  // pulse + saw, no sine
      traitPool:    ['aggressive', 'crushed', 'fastVibrato', 'pitchDrop', 'staccato', 'clean'],
      traitWeights: [3,            1,         2,             2,           2,           1],
      traitCount: [1, 2],
    },
    harmony: {
      archetypeWeights: [0, 3, 0, 0, 3],  // saw + buzzy
      traitPool:    ['aggressive', 'fastVibrato', 'staccato', 'clean'],
      traitWeights: [3,            2,             2,          2],
      traitCount: [1, 2],
    },
    bass: {
      archetypeWeights: [1, 3, 3, 0],  // square + saw (gritty)
      traitPool:    ['aggressive', 'staccato', 'pitchDrop', 'clean'],
      traitWeights: [3,            2,          1,           2],
      traitCount: [1, 2],
    },
    drums: {
      archetypeWeights: [1, 3, 1, 2, 1],  // tight favored
      traitPool:    ['aggressive', 'clean'],
      traitWeights: [2,            2],
      traitCount: [0, 1],
    },
  },

  synthwave: {
    lead: {
      archetypeWeights: [1, 1, 0, 4, 1],  // bright saw hero lead
      traitPool:    ['legato', 'vibrato', 'echoed', 'pitchBend', 'clean'],
      traitWeights: [3,        2,         2,        1,           1],
      traitCount: [1, 2],
    },
    harmony: {
      archetypeWeights: [0, 2, 3, 3, 0],  // warm analog-style pads
      traitPool:    ['legato', 'soft', 'echoed', 'vibrato'],
      traitWeights: [3,        2,      2,        1],
      traitCount: [1, 2],
    },
    bass: {
      archetypeWeights: [0, 3, 3, 1],  // square/saw synth bass, driving
      traitPool:    ['clean', 'staccato', 'legato'],
      traitWeights: [3,       2,          1],
      traitCount: [0, 1],
    },
    drums: {
      archetypeWeights: [3, 2, 1, 0, 2],  // gated 80s snare vibes
      traitPool:    ['clean', 'echoed'],
      traitWeights: [3,       2],
      traitCount: [0, 1],
    },
  },

  house: {
    lead: {
      archetypeWeights: [2, 3, 2, 1, 0],  // pulse stabs, piano-ish attack
      traitPool:    ['staccato', 'clean', 'echoed'],
      traitWeights: [3,          3,       1],
      traitCount: [1, 2],
    },
    harmony: {
      archetypeWeights: [0, 2, 0, 1, 3],  // buzzy organ/stab chords
      traitPool:    ['staccato', 'clean', 'echoed'],
      traitWeights: [3,          2,       1],
      traitCount: [1, 1],
    },
    bass: {
      archetypeWeights: [1, 1, 0, 4],  // deep sub bass
      traitPool:    ['clean', 'staccato'],
      traitWeights: [3,       2],
      traitCount: [0, 1],
    },
    drums: {
      archetypeWeights: [1, 4, 0, 1, 1],  // tight club kit
      traitPool:    ['aggressive', 'clean'],
      traitWeights: [2,            3],
      traitCount: [0, 1],
    },
  },

  lofi: {
    lead: {
      archetypeWeights: [1, 0, 0, 0, 4],  // mellow sine, keys-like
      traitPool:    ['soft', 'legato', 'echoed', 'vibrato'],
      traitWeights: [3,      3,        2,        1],
      traitCount: [1, 2],
    },
    harmony: {
      archetypeWeights: [0, 0, 3, 4, 0],  // hazy pads
      traitPool:    ['soft', 'legato', 'echoed'],
      traitWeights: [3,      3,        2],
      traitCount: [1, 2],
    },
    bass: {
      archetypeWeights: [3, 0, 0, 3],  // round triangle/sub bass
      traitPool:    ['soft', 'legato', 'clean'],
      traitWeights: [3,      2,        2],
      traitCount: [0, 1],
    },
    drums: {
      archetypeWeights: [1, 0, 4, 2, 0],  // boomy, dusty kit
      traitPool:    ['soft', 'echoed', 'crushed'],
      traitWeights: [3,      2,        1],
      traitCount: [0, 2],
    },
  },

  funk: {
    lead: {
      archetypeWeights: [1, 3, 3, 1, 0],  // narrow pulses, clav-like bite
      traitPool:    ['staccato', 'clean', 'pitchBend'],
      traitWeights: [4,          2,       1],
      traitCount: [1, 2],
    },
    harmony: {
      archetypeWeights: [3, 1, 0, 0, 2],  // tight rhythm stabs
      traitPool:    ['staccato', 'clean'],
      traitWeights: [4,          2],
      traitCount: [1, 1],
    },
    bass: {
      archetypeWeights: [2, 3, 1, 0],  // punchy square/triangle, the pocket
      traitPool:    ['staccato', 'clean', 'aggressive'],
      traitWeights: [3,          2,       1],
      traitCount: [1, 2],
    },
    drums: {
      archetypeWeights: [3, 3, 0, 0, 1],  // crisp and dry
      traitPool:    ['clean', 'aggressive'],
      traitWeights: [3,       1],
      traitCount: [0, 1],
    },
  },

  techno: {
    lead: {
      archetypeWeights: [1, 2, 3, 1, 0],  // nasal/narrow pulse stabs
      traitPool:    ['staccato', 'clean', 'crushed'],
      traitWeights: [3,          3,       1],
      traitCount: [1, 2],
    },
    harmony: {
      archetypeWeights: [0, 1, 0, 0, 4],  // buzzy hypnotic stabs
      traitPool:    ['staccato', 'clean'],
      traitWeights: [3,          2],
      traitCount: [1, 1],
    },
    bass: {
      archetypeWeights: [0, 2, 1, 4],  // rumbling sub
      traitPool:    ['clean', 'staccato'],
      traitWeights: [3,       2],
      traitCount: [0, 1],
    },
    drums: {
      archetypeWeights: [1, 4, 0, 1, 2],  // tight, machine-precise
      traitPool:    ['aggressive', 'clean'],
      traitWeights: [2,            3],
      traitCount: [0, 1],
    },
  },

  dub: {
    lead: {
      archetypeWeights: [1, 0, 0, 0, 4],  // melodica-ish soft sine
      traitPool:    ['echoed', 'soft', 'legato', 'vibrato'],
      traitWeights: [4,        2,      2,        1],
      traitCount: [1, 2],
    },
    harmony: {
      archetypeWeights: [0, 1, 3, 3, 0],  // skanking pads in space
      traitPool:    ['echoed', 'soft', 'staccato'],
      traitWeights: [4,        2,      2],
      traitCount: [1, 2],
    },
    bass: {
      archetypeWeights: [2, 0, 0, 4],  // heavyweight sub
      traitPool:    ['legato', 'soft', 'clean'],
      traitWeights: [3,        2,      2],
      traitCount: [0, 1],
    },
    drums: {
      archetypeWeights: [1, 0, 4, 0, 1],  // boomy, cavernous
      traitPool:    ['echoed', 'soft'],
      traitWeights: [4,        2],
      traitCount: [1, 2],
    },
  },

  idm: {
    lead: {
      archetypeWeights: [1, 2, 1, 1, 2],  // anything goes
      traitPool:    ['wobbly', 'crushed', 'pitchDrop', 'vibrato', 'echoed'],
      traitWeights: [3,        2,         2,           1,         1],
      traitCount: [1, 2],
    },
    harmony: {
      archetypeWeights: [1, 1, 2, 2, 1],  // detuned-feeling pads
      traitPool:    ['wobbly', 'echoed', 'soft'],
      traitWeights: [3,        2,        2],
      traitCount: [1, 2],
    },
    bass: {
      archetypeWeights: [1, 1, 1, 2],  // mutating low end
      traitPool:    ['crushed', 'clean', 'staccato', 'wobbly'],
      traitWeights: [2,         2,       2,          1],
      traitCount: [1, 2],
    },
    drums: {
      archetypeWeights: [1, 1, 0, 3, 2],  // crunched + metallic
      traitPool:    ['crushed', 'aggressive', 'clean'],
      traitWeights: [3,         1,            2],
      traitCount: [0, 2],
    },
  },

  hardcore: {
    lead: {
      archetypeWeights: [2, 1, 0, 4, 0],  // hoover-adjacent saw screech
      traitPool:    ['aggressive', 'crushed', 'fastVibrato', 'pitchDrop'],
      traitWeights: [3,            2,         2,             1],
      traitCount: [1, 2],
    },
    harmony: {
      archetypeWeights: [0, 4, 0, 0, 3],  // saw wall + buzz
      traitPool:    ['aggressive', 'crushed', 'staccato'],
      traitWeights: [3,            2,         2],
      traitCount: [1, 2],
    },
    bass: {
      archetypeWeights: [0, 3, 4, 0],  // distorted saw/square rumble
      traitPool:    ['aggressive', 'crushed', 'staccato'],
      traitWeights: [3,            2,         2],
      traitCount: [1, 2],
    },
    drums: {
      archetypeWeights: [0, 2, 1, 4, 1],  // the crushed gabber kick
      traitPool:    ['aggressive', 'crushed'],
      traitWeights: [3,            2],
      traitCount: [1, 2],
    },
  },

  dnb: {
    lead: {
      archetypeWeights: [1, 2, 0, 1, 3],  // liquid keys / airy pulse
      traitPool:    ['legato', 'echoed', 'vibrato', 'clean'],
      traitWeights: [3,        2,        1,         2],
      traitCount: [0, 2],
    },
    harmony: {
      archetypeWeights: [0, 1, 3, 3, 0],  // wide pads over the break
      traitPool:    ['legato', 'soft', 'echoed'],
      traitWeights: [3,        2,      2],
      traitCount: [1, 2],
    },
    bass: {
      archetypeWeights: [0, 1, 4, 2],  // reese-style saw / sub blend
      traitPool:    ['legato', 'wobbly', 'clean'],
      traitWeights: [3,        2,        2],
      traitCount: [1, 2],
    },
    drums: {
      archetypeWeights: [1, 4, 0, 1, 1],  // fast, snappy break kit
      traitPool:    ['aggressive', 'clean'],
      traitWeights: [2,            3],
      traitCount: [0, 1],
    },
  },

  punk: {
    lead: {
      archetypeWeights: [3, 1, 0, 3, 0],  // square + saw, wall of buzz
      traitPool:    ['aggressive', 'crushed', 'staccato', 'clean'],
      traitWeights: [3,            2,         2,          1],
      traitCount: [1, 2],
    },
    harmony: {
      archetypeWeights: [0, 3, 0, 0, 3],  // saw + buzzy power-chord grit
      traitPool:    ['aggressive', 'staccato', 'crushed'],
      traitWeights: [3,            2,          1],
      traitCount: [1, 2],
    },
    bass: {
      archetypeWeights: [0, 3, 3, 0],  // square/saw eighth-note wall
      traitPool:    ['aggressive', 'staccato', 'clean'],
      traitWeights: [3,            3,          1],
      traitCount: [1, 2],
    },
    drums: {
      archetypeWeights: [1, 3, 0, 3, 0],  // tight or trashy
      traitPool:    ['aggressive', 'clean'],
      traitWeights: [3,            1],
      traitCount: [0, 1],
    },
  },
};

// --- GENERATION ---

function buildInstrument(
  archetypes: Archetype[],
  config: VibeTraitConfig,
  forcedName?: string | null,
): ZzFXSound {
  // 1. Pick archetype — an explicit name wins, else weighted by the vibe
  const archetype =
    (forcedName ? archetypes.find((a) => a.name === forcedName) : undefined) ??
    weightedPick(archetypes, config.archetypeWeights);
  const params = [...archetype.params] as ZzFXSound;

  // 2. Pick and apply traits
  const [minTraits, maxTraits] = config.traitCount;
  const numTraits = minTraits + Math.floor(Math.random() * (maxTraits - minTraits + 1));
  const usedTraits = new Set<TraitName>();

  for (let i = 0; i < numTraits; i++) {
    const trait = weightedPick(config.traitPool, config.traitWeights);
    if (usedTraits.has(trait)) continue; // no duplicate traits
    usedTraits.add(trait);
    TRAITS[trait](params);
  }

  // 3. Micro-randomness — subtle per-regen variation
  params[0] *= randRange(0.9, 1.1);    // volume
  params[4] *= randRange(0.85, 1.15);  // sustain
  params[5] *= randRange(0.85, 1.15);  // release

  return params;
}

const ROLE_ARCHETYPES: Record<ChannelRole, Archetype[]> = {
  lead: LEAD_ARCHETYPES,
  harmony: HARMONY_ARCHETYPES,
  bass: BASS_ARCHETYPES,
  drums: DRUM_ARCHETYPES,
};

// The three drum channels share the drum archetypes but are voiced apart:
// a low boomy kick, a mid snare crack, a short bright hat.
const DRUM_VOICING: Record<number, { freq: number; sustain: number; release: number; noise: number }> = {
  [CH_KICK]: { freq: 0.42, sustain: 1.5, release: 1.4, noise: 0.55 },
  [CH_SNARE]: { freq: 1.15, sustain: 1.0, release: 1.0, noise: 1.5 },
  [CH_HAT]: { freq: 2.6, sustain: 0.35, release: 0.45, noise: 2.2 },
};

function voiceDrum(params: ZzFXSound, channelIndex: number): ZzFXSound {
  const v = DRUM_VOICING[channelIndex];
  if (!v) return params;
  const p = [...params];
  p[2] = (p[2] ?? 350) * v.freq;                          // frequency
  p[4] = (p[4] ?? 0.01) * v.sustain;                      // sustain
  p[5] = (p[5] ?? 0.08) * v.release;                      // release
  p[13] = Math.min(2.5, (p[13] ?? 0.5) * v.noise);        // noise
  if (channelIndex === CH_HAT) p[8] = 0;                  // hats don't sweep
  return p;
}

// Build one channel's instrument from a specific vibe — used when a channel
// has its own vibe override. An optional `sound` forces a named archetype
// (the selectable timbre palette); null/undefined = vibe-weighted pick.
export function generateInstrumentForChannel(
  vibe: VibeName,
  channelIndex: number,
  sound?: string | null,
): ZzFXSound {
  const family = CHANNELS[channelIndex]?.family ?? 'lead';
  const params = buildInstrument(ROLE_ARCHETYPES[family], VIBE_TRAITS[vibe][family], sound);
  return family === 'drums' ? voiceDrum(params, channelIndex) : params;
}

export function generateInstruments(vibe: VibeName): ZzFXSound[] {
  return Array.from({ length: CHANNEL_COUNT }, (_, ch) => generateInstrumentForChannel(vibe, ch));
}

// Selectable timbre palette per channel — the named archetypes for its family.
// A null choice (AUTO) falls back to the vibe-weighted pick.
export const CHANNEL_SOUND_OPTIONS: { value: string; label: string }[][] =
  CHANNELS.map((channel) =>
    ROLE_ARCHETYPES[channel.family].map((a) => ({
      value: a.name,
      label: a.name.replace(/-/g, ' ').toUpperCase(),
    }))
  );
