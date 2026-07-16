import { VibeName, VibeConfig } from './types';

// Structure templates follow retro conventions:
//
// Short (4-6 patterns, ~15-25s): A/B only. Simple alternation.
//   Authentic for: jingles, short battle themes, victory fanfares
//
// Long (7-10 patterns, ~30-50s): A/B/C. Bridges and breakdowns.
//   Authentic for: overworld themes, dungeon music, standard stage music
//
// Epic (10-14 patterns, ~45-70s): A/B/C/D. Full arc with climax.
//   Authentic for: final boss, title screen medleys, fortress themes
//
// Section roles:
//   verse     — main theme, full arrangement
//   contrast  — different melody/chords, tension
//   bridge    — transitional, sparser, breathing room
//   breakdown — drums+bass only, lead/harmony drop out
//   climax    — highest energy, densest arrangement

export const VIBE_CONFIG: Record<VibeName, VibeConfig> = {
  adventure: {
    bpmRange: [110, 135],
    preferredScales: ['major', 'mixolydian', 'pentatonic'],
    melodyDensity: 0.5,
    bassDensity: [4, 7],
    drumIntensity: 'medium',
    structures: {
      short: [
        { roles: ['verse', 'contrast'], sequence: [0, 0, 1, 0] },
        { roles: ['verse', 'contrast'], sequence: [0, 1, 0, 1, 0] },
      ],
      long: [
        // A A B A A C B A — classic Zelda-style overworld
        { roles: ['verse', 'contrast', 'bridge'], sequence: [0, 0, 1, 0, 0, 2, 1, 0] },
        // A A B A C A B A — bridge before final repeat
        { roles: ['verse', 'contrast', 'bridge'], sequence: [0, 0, 1, 0, 2, 0, 1, 0] },
        // A B A B C A — shorter long
        { roles: ['verse', 'contrast', 'breakdown'], sequence: [0, 1, 0, 1, 2, 0, 1] },
      ],
      epic: [
        // A A B A C A B D B A — full arc
        { roles: ['verse', 'contrast', 'breakdown', 'climax'], sequence: [0, 0, 1, 0, 2, 0, 1, 3, 1, 0] },
        // A A B A A C B D C A B A
        { roles: ['verse', 'contrast', 'bridge', 'climax'], sequence: [0, 0, 1, 0, 0, 2, 1, 3, 2, 0, 1, 0] },
      ],
    },
    fxChance: 0.2,
  },

  battle: {
    bpmRange: [125, 150],
    preferredScales: ['minor', 'harmonicMinor', 'dorian'],
    melodyDensity: 0.7,
    bassDensity: [6, 9],
    drumIntensity: 'high',
    structures: {
      short: [
        // A B A B — tight alternation, Pokemon trainer battle style
        { roles: ['verse', 'contrast'], sequence: [0, 1, 0, 1] },
        { roles: ['verse', 'contrast'], sequence: [0, 0, 1, 1, 0] },
      ],
      long: [
        // A B A B C B — classic battle with bridge
        { roles: ['verse', 'contrast', 'climax'], sequence: [0, 1, 0, 1, 2, 1] },
        // A B A B C A B — Mega Man style
        { roles: ['verse', 'contrast', 'bridge'], sequence: [0, 1, 0, 1, 2, 0, 1] },
        // A A B B C B A — buildup to bridge
        { roles: ['verse', 'contrast', 'breakdown'], sequence: [0, 0, 1, 1, 2, 1, 0, 1] },
      ],
      epic: [
        // A B A B C C A B D B — full battle arc
        { roles: ['verse', 'contrast', 'breakdown', 'climax'], sequence: [0, 1, 0, 1, 2, 2, 0, 1, 3, 1] },
        // A B C A B C D A B D
        { roles: ['verse', 'contrast', 'bridge', 'climax'], sequence: [0, 1, 2, 0, 1, 2, 3, 0, 1, 3] },
      ],
    },
    fxChance: 0.4,
  },

  dungeon: {
    bpmRange: [80, 105],
    preferredScales: ['minor', 'dorian'],
    melodyDensity: 0.3,
    bassDensity: [3, 5],
    drumIntensity: 'sparse',
    structures: {
      short: [
        // A A B A — repetitive, hypnotic
        { roles: ['verse', 'contrast'], sequence: [0, 0, 1, 0] },
        { roles: ['verse', 'breakdown'], sequence: [0, 0, 1, 0, 0] },
      ],
      long: [
        // A A B B A C A — Metroid Brinstar style
        { roles: ['verse', 'contrast', 'breakdown'], sequence: [0, 0, 1, 1, 0, 2, 0] },
        // A B A A C A B A — atmospheric loop
        { roles: ['verse', 'contrast', 'bridge'], sequence: [0, 1, 0, 0, 2, 0, 1, 0] },
      ],
      epic: [
        // A A B A C A B D A B A — deep dungeon
        { roles: ['verse', 'contrast', 'breakdown', 'bridge'], sequence: [0, 0, 1, 0, 2, 0, 1, 3, 0, 1, 0] },
        // A B A C A B D C A B A
        { roles: ['verse', 'contrast', 'breakdown', 'climax'], sequence: [0, 1, 0, 2, 0, 1, 3, 2, 0, 1, 0] },
      ],
    },
    fxChance: 0.15,
  },

  titleScreen: {
    bpmRange: [95, 120],
    preferredScales: ['major', 'pentatonic'],
    melodyDensity: 0.4,
    bassDensity: [3, 6],
    drumIntensity: 'light',
    structures: {
      short: [
        // A A B A — simple, welcoming
        { roles: ['verse', 'contrast'], sequence: [0, 0, 1, 0] },
      ],
      long: [
        // A A B A B C A — gentle arc
        { roles: ['verse', 'contrast', 'bridge'], sequence: [0, 0, 1, 0, 1, 2, 0] },
        // A A B A C A B A — extended theme
        { roles: ['verse', 'contrast', 'bridge'], sequence: [0, 0, 1, 0, 2, 0, 1, 0] },
      ],
      epic: [
        // A A B A C B D A B C A — title medley
        { roles: ['verse', 'contrast', 'bridge', 'climax'], sequence: [0, 0, 1, 0, 2, 1, 3, 0, 1, 2, 0] },
        // A A B A A C B D C B A
        { roles: ['verse', 'contrast', 'breakdown', 'climax'], sequence: [0, 0, 1, 0, 0, 2, 1, 3, 2, 1, 0] },
      ],
    },
    fxChance: 0.1,
  },

  boss: {
    bpmRange: [135, 160],
    preferredScales: ['harmonicMinor', 'minor', 'dorian'],
    melodyDensity: 0.8,
    bassDensity: [7, 10],
    drumIntensity: 'intense',
    structures: {
      short: [
        // A B A B C — short boss with climax hit
        { roles: ['verse', 'contrast', 'climax'], sequence: [0, 1, 0, 1, 2] },
        { roles: ['verse', 'contrast'], sequence: [0, 1, 0, 1, 0, 1] },
      ],
      long: [
        // A B C A B D — Castlevania style
        { roles: ['verse', 'contrast', 'bridge', 'climax'], sequence: [0, 1, 2, 0, 1, 3] },
        // A B A B C B D B — relentless
        { roles: ['verse', 'contrast', 'breakdown', 'climax'], sequence: [0, 1, 0, 1, 2, 1, 3, 1] },
      ],
      epic: [
        // A B C A B C D A B D C B — final boss epic
        { roles: ['verse', 'contrast', 'bridge', 'climax'], sequence: [0, 1, 2, 0, 1, 2, 3, 0, 1, 3, 2, 1] },
        // A A B A C B D B C D A B
        { roles: ['verse', 'contrast', 'breakdown', 'climax'], sequence: [0, 0, 1, 0, 2, 1, 3, 1, 2, 3, 0, 1] },
      ],
    },
    fxChance: 0.5,
  },

  // --- GENRE VIBES ---
  // Structures below follow the conventions of their genres rather than
  // game-music forms: verse-chorus (synthwave, punk), build-drop (house),
  // loop-based (lofi), vamp-and-bridge (funk). Section roles map onto the
  // genre parts: climax = chorus/drop, breakdown = drums+bass section.

  synthwave: {
    bpmRange: [84, 108],
    preferredScales: ['minor', 'dorian'],
    melodyDensity: 0.4,
    bassDensity: [6, 9],
    drumIntensity: 'medium',
    structures: {
      short: [
        // V C V C — instant verse/chorus alternation
        { roles: ['verse', 'climax'], sequence: [0, 1, 0, 1] },
        { roles: ['verse', 'contrast'], sequence: [0, 0, 1, 0] },
      ],
      long: [
        // V V C V V C B C — classic pop form, bridge before final chorus
        { roles: ['verse', 'climax', 'bridge'], sequence: [0, 0, 1, 0, 0, 1, 2, 1] },
        // V C V C D(breakdown) C C — chorus-heavy outrun anthem
        { roles: ['verse', 'climax', 'breakdown'], sequence: [0, 1, 0, 1, 2, 1, 1] },
      ],
      epic: [
        // V V C V C B D C C V — full night-drive arc
        { roles: ['verse', 'climax', 'bridge', 'breakdown'], sequence: [0, 0, 1, 0, 1, 2, 3, 1, 1, 0] },
        { roles: ['verse', 'contrast', 'climax', 'breakdown'], sequence: [0, 0, 1, 2, 0, 1, 2, 3, 2, 2] },
      ],
    },
    fxChance: 0.25,
  },

  house: {
    bpmRange: [120, 128],
    preferredScales: ['minor', 'dorian'],
    melodyDensity: 0.35,
    bassDensity: [6, 9],
    drumIntensity: 'high',
    structures: {
      short: [
        // groove -> drop -> drop: straight to the point
        { roles: ['verse', 'bridge', 'climax'], sequence: [0, 1, 2, 2] },
        { roles: ['verse', 'climax'], sequence: [0, 1, 0, 1] },
      ],
      long: [
        // groove groove build DROP DROP breakdown build DROP DROP
        { roles: ['verse', 'bridge', 'climax', 'breakdown'], sequence: [0, 0, 1, 2, 2, 3, 1, 2, 2] },
        // intro groove build drop drop groove build drop
        { roles: ['verse', 'bridge', 'climax'], sequence: [0, 1, 2, 2, 0, 1, 2, 2] },
      ],
      epic: [
        // two full build-drop cycles with a stripped breakdown between
        { roles: ['verse', 'bridge', 'climax', 'breakdown'], sequence: [0, 0, 1, 2, 2, 3, 3, 1, 2, 2, 0] },
        { roles: ['verse', 'bridge', 'climax', 'breakdown'], sequence: [0, 1, 2, 2, 3, 1, 2, 2, 2, 0] },
      ],
    },
    fxChance: 0.3,
  },

  lofi: {
    bpmRange: [70, 88],
    preferredScales: ['dorian', 'pentatonic', 'minor'],
    melodyDensity: 0.25,
    bassDensity: [3, 5],
    drumIntensity: 'light',
    structures: {
      short: [
        // hypnotic loop with one variation
        { roles: ['verse', 'contrast'], sequence: [0, 0, 1, 0] },
        { roles: ['verse', 'breakdown'], sequence: [0, 0, 1, 0, 0] },
      ],
      long: [
        // loop, drums-only breather, loop — beats-to-relax-to
        { roles: ['verse', 'contrast', 'breakdown'], sequence: [0, 0, 1, 0, 2, 0, 1, 0] },
        { roles: ['verse', 'contrast', 'bridge'], sequence: [0, 0, 0, 1, 0, 2, 1, 0] },
      ],
      epic: [
        // long-form loop with slow variation drift
        { roles: ['verse', 'contrast', 'breakdown', 'bridge'], sequence: [0, 0, 1, 0, 2, 0, 1, 3, 0, 1, 0] },
        { roles: ['verse', 'contrast', 'breakdown'], sequence: [0, 0, 1, 0, 0, 2, 1, 0, 1, 0, 0] },
      ],
    },
    fxChance: 0.15,
  },

  funk: {
    bpmRange: [96, 116],
    preferredScales: ['dorian', 'mixolydian'],
    melodyDensity: 0.4,
    bassDensity: [7, 10],
    drumIntensity: 'medium',
    structures: {
      short: [
        // stay on the one
        { roles: ['verse', 'contrast'], sequence: [0, 0, 1, 0] },
        { roles: ['verse', 'breakdown'], sequence: [0, 1, 0, 1] },
      ],
      long: [
        // vamp vamp horn-hit vamp bridge horn-hit vamp — James Brown form
        { roles: ['verse', 'contrast', 'bridge'], sequence: [0, 0, 1, 0, 0, 2, 1, 0] },
        // vamp with a drums+bass breakdown in the pocket
        { roles: ['verse', 'contrast', 'breakdown'], sequence: [0, 0, 1, 1, 2, 0, 0] },
      ],
      epic: [
        // extended jam: vamp, hits, breakdown, all-in finale
        { roles: ['verse', 'contrast', 'breakdown', 'climax'], sequence: [0, 0, 1, 0, 2, 0, 1, 3, 1, 0] },
        { roles: ['verse', 'contrast', 'breakdown', 'climax'], sequence: [0, 1, 0, 0, 2, 1, 0, 3, 3, 0, 1] },
      ],
    },
    fxChance: 0.35,
  },

  punk: {
    bpmRange: [160, 185],
    preferredScales: ['major', 'mixolydian'],
    melodyDensity: 0.6,
    bassDensity: [8, 12],
    drumIntensity: 'intense',
    structures: {
      short: [
        // verse chorus verse chorus, no fat
        { roles: ['verse', 'climax'], sequence: [0, 1, 0, 1] },
        { roles: ['verse', 'contrast'], sequence: [0, 0, 1, 1] },
      ],
      long: [
        // V C V C bridge C C — three-chord anthem
        { roles: ['verse', 'climax', 'bridge'], sequence: [0, 1, 0, 1, 2, 1, 1] },
        // V V C V V C D(halftime) C
        { roles: ['verse', 'climax', 'breakdown'], sequence: [0, 0, 1, 0, 0, 1, 2, 1] },
      ],
      epic: [
        // as epic as two minutes gets: double chorus outro
        { roles: ['verse', 'climax', 'bridge', 'breakdown'], sequence: [0, 1, 0, 1, 2, 0, 1, 3, 1, 1] },
        { roles: ['verse', 'contrast', 'climax', 'breakdown'], sequence: [0, 1, 0, 1, 2, 0, 1, 3, 2, 2] },
      ],
    },
    fxChance: 0.45,
  },
};

export function getRandomBpm(vibe: VibeName): number {
  const [min, max] = VIBE_CONFIG[vibe].bpmRange;
  return Math.floor(min + Math.random() * (max - min + 1));
}
