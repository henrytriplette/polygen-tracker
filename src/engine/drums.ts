import { VibeName, ChannelData, DRUM_HIT_NOTE, CH_KICK, CH_SNARE, CH_HAT } from './types';
import { euclidean } from './euclidean';

const ROWS = 32;

// Key insight from SynthyCraft: drums should be TEMPLATE-DRIVEN with minimal randomness.
// The kick is the backbone and should be predictable. Snare has weighted options.
// Hats fill gaps. This creates reliable, musical patterns.

// Kick templates — the structural backbone. Always predictable.
const KICK_TEMPLATES: Record<VibeName, { base: number[]; ghostChance: number; ghostPositions: number[] }> = {
  adventure: {
    // Standard four-on-floor (every 8 rows = every beat in 32-row pattern)
    base: [0, 8, 16, 24],
    ghostChance: 0.15,
    ghostPositions: [6, 14, 22, 30],
  },
  battle: {
    // Driving eighth-note kicks
    base: [0, 4, 8, 12, 16, 20, 24, 28],
    ghostChance: 0.1,
    ghostPositions: [2, 6, 10, 14],
  },
  dungeon: {
    // Half-time feel
    base: [0, 16],
    ghostChance: 0.2,
    ghostPositions: [12, 28],
  },
  titleScreen: {
    // Standard four-on-floor
    base: [0, 8, 16, 24],
    ghostChance: 0.1,
    ghostPositions: [6, 22],
  },
  boss: {
    // Syncopated driving pattern
    base: [0, 6, 8, 14, 16, 22, 24, 30],
    ghostChance: 0.15,
    ghostPositions: [4, 12, 20, 28],
  },
  synthwave: {
    // Steady four-on-floor, occasional pickup into the next bar
    base: [0, 8, 16, 24],
    ghostChance: 0.15,
    ghostPositions: [14, 30],
  },
  house: {
    // Relentless four-on-floor — the genre's heartbeat
    base: [0, 8, 16, 24],
    ghostChance: 0.05,
    ghostPositions: [30],
  },
  lofi: {
    // Boom-bap: kick on the one, lazy off-grid follow-ups
    base: [0, 10, 16, 26],
    ghostChance: 0.25,
    ghostPositions: [6, 20],
  },
  funk: {
    // Emphasis on The One, syncopated 16th pickups
    base: [0, 10, 16, 22],
    ghostChance: 0.3,
    ghostPositions: [6, 26, 30],
  },
  punk: {
    // Flat-out eighth-note kicks
    base: [0, 4, 8, 12, 16, 20, 24, 28],
    ghostChance: 0.1,
    ghostPositions: [2, 18],
  },
  techno: {
    // Unwavering four-on-the-floor, machine-strict
    base: [0, 8, 16, 24],
    ghostChance: 0.1,
    ghostPositions: [30],
  },
  dub: {
    // Steppers-meets-one-drop: weight on 1 and the drop on 3
    base: [0, 16],
    ghostChance: 0.3,
    ghostPositions: [24, 28],
  },
  idm: {
    // Deliberately broken grid — syncopated anchors, chaotic ghosts
    base: [0, 6, 16, 26],
    ghostChance: 0.45,
    ghostPositions: [10, 12, 20, 30],
  },
  hardcore: {
    // Relentless gabber stomp: kick every half-beat
    base: [0, 4, 8, 12, 16, 20, 24, 28],
    ghostChance: 0.2,
    ghostPositions: [2, 10, 18, 26],
  },
  dnb: {
    // Two-step: kick on the one and the off-kilter pickup
    base: [0, 10],
    ghostChance: 0.35,
    ghostPositions: [20, 26, 30],
  },
};

// Snare: probability-weighted template selection (SynthyCraft technique)
function generateSnareHits(vibe: VibeName): number[] {
  const hits: number[] = [];
  const p = Math.random();

  switch (vibe) {
    case 'adventure':
    case 'titleScreen':
      // Standard backbeat on beats 2 and 4
      if (p < 0.7) { hits.push(8, 24); }
      else if (p < 0.85) { hits.push(8, 20, 24); } // extra hit
      else { hits.push(4, 12, 20, 28); } // offbeat
      break;
    case 'battle':
      if (p < 0.5) { hits.push(4, 12, 20, 28); } // driving
      else if (p < 0.8) { hits.push(8, 24); } // backbeat
      else { hits.push(4, 8, 12, 20, 24, 28); } // double-time
      break;
    case 'dungeon':
      if (p < 0.6) { hits.push(8, 24); } // sparse backbeat
      else if (p < 0.9) { hits.push(12); } // single hit
      else { hits.push(8); } // minimal
      break;
    case 'boss':
      if (p < 0.5) { hits.push(4, 12, 20, 28); } // driving offbeat
      else if (p < 0.75) { hits.push(6, 14, 22, 30); } // syncopated
      else { // euclidean
        const euc = euclidean(3, 32, Math.floor(Math.random() * 8));
        for (let i = 0; i < ROWS; i++) { if (euc[i]) hits.push(i); }
      }
      break;
    case 'synthwave':
      // Big gated snare on the backbeat, occasionally doubled before bar end
      if (p < 0.75) { hits.push(8, 24); }
      else if (p < 0.9) { hits.push(8, 24, 30); } // fill into next bar
      else { hits.push(8, 20, 24); }
      break;
    case 'house':
      // Clap on 2 and 4, sometimes an extra skip clap
      if (p < 0.7) { hits.push(8, 24); }
      else if (p < 0.9) { hits.push(8, 24, 28); } // skipped clap
      else { hits.push(8, 24, 14); }
      break;
    case 'lofi':
      // Lazy backbeat, sometimes dragging late
      if (p < 0.7) { hits.push(8, 24); }
      else if (p < 0.9) { hits.push(9, 24); } // dragged snare
      else { hits.push(8, 25); }
      break;
    case 'funk':
      // Backbeat plus ghost-note chatter
      if (p < 0.5) { hits.push(8, 24); }
      else if (p < 0.8) { hits.push(8, 24, 14, 30); } // ghosted 16ths
      else { hits.push(4, 12, 20, 28); } // displaced
      break;
    case 'punk':
      // Hard backbeat or all-out double-time
      if (p < 0.5) { hits.push(8, 24); }
      else if (p < 0.85) { hits.push(4, 12, 20, 28); } // double-time thrash
      else { hits.push(8, 24, 28, 30); } // fill into the repeat
      break;
    case 'techno':
      // Minimal: sparse claps, sometimes none at all — the kick is the music
      if (p < 0.5) { hits.push(8, 24); }
      else if (p < 0.8) { hits.push(24); } // single late clap
      // else: no snare — pure kick hypnosis
      break;
    case 'dub':
      // Rimshot on the drop, ends drifting in delay
      if (p < 0.6) { hits.push(8, 24); }
      else if (p < 0.85) { hits.push(24); } // sparse, spacious
      else { hits.push(8, 24, 26); } // delay-tail feel
      break;
    case 'idm':
      // Programmed chaos: euclidean scatters or displaced backbeats
      if (p < 0.4) {
        const euc = euclidean(5, 32, Math.floor(Math.random() * 16));
        for (let i = 0; i < ROWS; i++) { if (euc[i]) hits.push(i); }
      } else if (p < 0.7) {
        const euc = euclidean(7, 32, Math.floor(Math.random() * 16));
        for (let i = 0; i < ROWS; i++) { if (euc[i]) hits.push(i); }
      } else { hits.push(6, 14, 22, 30); } // displaced backbeat
      break;
    case 'hardcore':
      // Offbeat stabs riding the kick wall
      if (p < 0.5) { hits.push(4, 12, 20, 28); }
      else if (p < 0.8) { hits.push(8, 24); }
      else {
        const euc = euclidean(5, 32, Math.floor(Math.random() * 8));
        for (let i = 0; i < ROWS; i++) { if (euc[i]) hits.push(i); }
      }
      break;
    case 'dnb':
      // The break: snare on 2 and 4, with chopped variations
      if (p < 0.6) { hits.push(8, 24); }
      else if (p < 0.85) { hits.push(8, 24, 30); } // chopped tail
      else { hits.push(8, 20, 24); } // shuffled mid hit
      break;
  }
  return hits;
}

// Hats ride the eighth-note grid. They have their own channel now, so they
// can sound on top of kicks and snares like a real kit; rows shared with
// another drum are just slightly less likely, keeping the gap-filling feel.
function generateHatHits(
  kickHits: Set<number>,
  snareHits: Set<number>,
  density: number
): number[] {
  const hits: number[] = [];
  for (let i = 0; i < ROWS; i++) {
    if (i % 2 !== 0) continue; // every-other-step grid
    const shared = kickHits.has(i) || snareHits.has(i);
    if (Math.random() < (shared ? density * 0.7 : density)) {
      hits.push(i);
    }
  }
  return hits;
}

const HAT_DENSITY: Record<VibeName, number> = {
  adventure: 0.6,
  battle: 0.8,
  dungeon: 0.3,
  titleScreen: 0.5,
  boss: 0.7,
  synthwave: 0.55,
  house: 0.85, // offbeat hats carry the pump
  lofi: 0.35,
  funk: 0.75,
  punk: 0.8,
  techno: 0.9, // ticking offbeats fill everything the kick leaves
  dub: 0.4,
  idm: 0.55,
  hardcore: 0.7,
  dnb: 0.65,
};

export interface DrumChannels {
  /** One ChannelData per drum channel: kick, snare, hat. */
  channels: ChannelData[];
  /** 1 where a kick lands — used to sync the bass. */
  kickPattern: number[];
}

/** Turn a set of hit rows into ChannelData for one drum channel. */
export function drumChannelFromHits(hits: Set<number> | number[], channelIndex: number): ChannelData {
  const set = hits instanceof Set ? hits : new Set(hits);
  const notes: number[] = Array(ROWS).fill(0);
  for (let i = 0; i < ROWS; i++) if (set.has(i)) notes[i] = DRUM_HIT_NOTE;
  return [channelIndex, 0, ...notes];
}

export function generateDrumPattern(vibe: VibeName): DrumChannels {
  const kickTemplate = KICK_TEMPLATES[vibe];

  // Build kick hits from template + optional ghosts
  const kickHits = new Set(kickTemplate.base);
  for (const pos of kickTemplate.ghostPositions) {
    if (Math.random() < kickTemplate.ghostChance) {
      kickHits.add(pos);
    }
  }

  // Build snare hits from weighted templates
  const snareHits = new Set(generateSnareHits(vibe));

  // Build hat hits (gap-filling). Hats may now overlap kicks and snares,
  // since every drum has its own channel.
  const hatHits = new Set(generateHatHits(kickHits, snareHits, HAT_DENSITY[vibe]));

  const kickArray: number[] = Array(ROWS).fill(0);
  for (const row of kickHits) kickArray[row] = 1;

  return {
    channels: [
      drumChannelFromHits(kickHits, CH_KICK),
      drumChannelFromHits(snareHits, CH_SNARE),
      drumChannelFromHits(hatHits, CH_HAT),
    ],
    kickPattern: kickArray,
  };
}
