import { NoteName, ScaleName, ChannelData, RHYTHM_PERIOD, rowsPerChord } from './types';
import { ChordProgression } from './chords';

const ROWS_PER_CHORD = RHYTHM_PERIOD;

// Harmony patterns for one chord segment
// These define how chord tones are arpeggiated
// r=root, t=third, f=fifth, 0=rest
type ArpNote = 'r' | 't' | 'f' | '0';

const ARP_PATTERNS: ArpNote[][] = [
  // Classic arpeggios
  ['r', 't', 'f', 't', 'r', 't', 'f', 't'],    // up-down
  ['r', 'f', 't', '0', 'r', 'f', 't', '0'],    // wide bounce
  ['r', '0', 't', '0', 'f', '0', 't', '0'],    // spaced arp
  ['r', 't', 'f', '0', 'f', 't', 'r', '0'],    // full cycle

  // Pad-like (sustained chord tones)
  ['r', '0', '0', '0', 't', '0', '0', '0'],    // sparse pad
  ['f', '0', '0', 'r', '0', '0', 't', '0'],    // wide pad

  // Rhythmic
  ['r', 'r', 't', 't', 'f', 'f', 't', 't'],    // doubled
  ['r', '0', 'r', 't', '0', 't', 'f', '0'],    // stutter arp
];

const SPARSE_ARP_PATTERNS: ArpNote[][] = [
  ['r', '0', '0', '0', 't', '0', '0', '0'],
  ['r', '0', '0', '0', '0', '0', 'f', '0'],
  ['t', '0', '0', '0', '0', '0', '0', '0'],
  ['r', '0', '0', 'f', '0', '0', '0', '0'],
];

const DENSE_ARP_PATTERNS: ArpNote[][] = [
  ['r', 't', 'f', 'r', 't', 'f', 'r', 't'],    // continuous up
  ['r', 'r', 't', 'f', 'f', 't', 'r', 'r'],    // pulsing
  ['r', 't', 'f', 't', 'f', 'r', 't', 'f'],    // rolling
];

function pickArpPattern(melodyNotes: number[]): ArpNote[] {
  // Count how many melody notes are active to gauge density
  const melodyDensity = melodyNotes.filter(n => n > 0).length / melodyNotes.length;

  if (melodyDensity > 0.5) {
    // Dense melody: use sparse harmony to avoid clutter
    return SPARSE_ARP_PATTERNS[Math.floor(Math.random() * SPARSE_ARP_PATTERNS.length)];
  }
  if (melodyDensity < 0.2) {
    // Sparse melody: harmony can be denser to fill space
    return DENSE_ARP_PATTERNS[Math.floor(Math.random() * DENSE_ARP_PATTERNS.length)];
  }
  return ARP_PATTERNS[Math.floor(Math.random() * ARP_PATTERNS.length)];
}

function resolveArpNote(
  arpNote: ArpNote,
  root: number,
  third: number,
  fifth: number,
): number {
  switch (arpNote) {
    case 'r': return root;
    case 't': return third;
    case 'f': return fifth;
    case '0': return 0;
  }
}

export function generateHarmonyPattern(
  key: NoteName,
  scale: ScaleName,
  melodyNotes: number[],
  progression: ChordProgression
): ChannelData {
  const length = progression.chordAtRow.length;
  const perChord = rowsPerChord(length);

  // One arp pattern throughout for consistency, with a 40% chance of a
  // contrasting one on alternate chord segments.
  const arpA = pickArpPattern(melodyNotes);
  const arpB = Math.random() < 0.4 ? pickArpPattern(melodyNotes) : arpA;

  const notes: number[] = Array(length).fill(0);
  for (let row = 0; row < length; row++) {
    // The arp figure repeats every ROWS_PER_CHORD rows regardless of length
    const arp = Math.floor(row / perChord) % 2 === 0 ? arpA : arpB;
    const chord = progression.chordAtRow[row];

    // If the melody is playing on this row, usually rest to avoid clutter
    if (melodyNotes[row] > 0 && Math.random() < 0.7) continue;

    notes[row] = resolveArpNote(
      arp[row % ROWS_PER_CHORD],
      chord.rootMelody,
      chord.thirdMelody,
      chord.fifthMelody,
    );
  }

  return [1, 0, ...notes];
}
