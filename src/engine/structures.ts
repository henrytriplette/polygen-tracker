// User-selectable song structures. 'AUTO' (null) keeps the vibe's own
// structure templates; these named forms work with any vibe and use the full
// section vocabulary (verse / contrast / bridge / breakdown / climax /
// chorus / refrain).
import { SongLength, StructureTemplate } from './types';

export interface StructureOption {
  id: string;
  label: string;
  description: string;
  structures: Record<SongLength, StructureTemplate[]>;
}

export const STRUCTURE_OPTIONS: StructureOption[] = [
  {
    id: 'verseChorus',
    label: 'VERSE-CHORUS',
    description: 'Classic pop form: alternating verses and choruses, bridge before the last chorus',
    structures: {
      short: [
        { roles: ['verse', 'chorus'], sequence: [0, 1, 0, 1] },
      ],
      long: [
        // V C V C B C C
        { roles: ['verse', 'chorus', 'bridge'], sequence: [0, 1, 0, 1, 2, 1, 1] },
        // V V C V C D(contrast) C
        { roles: ['verse', 'chorus', 'contrast'], sequence: [0, 0, 1, 0, 1, 2, 1] },
      ],
      epic: [
        // V C V C B C D(breakdown) C C
        { roles: ['verse', 'chorus', 'bridge', 'breakdown'], sequence: [0, 1, 0, 1, 2, 1, 3, 1, 1] },
        { roles: ['verse', 'chorus', 'contrast', 'bridge'], sequence: [0, 1, 0, 1, 2, 3, 1, 1, 0, 1] },
      ],
    },
  },
  {
    id: 'verseRefrain',
    label: 'VERSE-REFRAIN',
    description: 'Folk/ballad form: every verse answered by a short recurring refrain',
    structures: {
      short: [
        { roles: ['verse', 'refrain'], sequence: [0, 1, 0, 1] },
      ],
      long: [
        // V R V R C(contrast) V R
        { roles: ['verse', 'refrain', 'contrast'], sequence: [0, 1, 0, 1, 2, 0, 1] },
        { roles: ['verse', 'refrain', 'bridge'], sequence: [0, 1, 0, 1, 2, 1, 0, 1] },
      ],
      epic: [
        { roles: ['verse', 'refrain', 'contrast', 'breakdown'], sequence: [0, 1, 0, 1, 2, 1, 3, 0, 1, 1] },
        { roles: ['verse', 'refrain', 'bridge', 'chorus'], sequence: [0, 1, 0, 1, 2, 1, 3, 1, 0, 1] },
      ],
    },
  },
  {
    id: 'aaba',
    label: 'AABA (32-BAR)',
    description: 'Tin Pan Alley / jazz standard form: two themes, a bridge, and home again',
    structures: {
      short: [
        { roles: ['verse', 'bridge'], sequence: [0, 0, 1, 0] },
      ],
      long: [
        { roles: ['verse', 'bridge'], sequence: [0, 0, 1, 0, 0, 0, 1, 0] },
        { roles: ['verse', 'bridge', 'contrast'], sequence: [0, 0, 1, 0, 2, 0, 1, 0] },
      ],
      epic: [
        { roles: ['verse', 'bridge', 'chorus'], sequence: [0, 0, 1, 0, 0, 0, 1, 0, 2, 0] },
        { roles: ['verse', 'bridge', 'breakdown'], sequence: [0, 0, 1, 0, 2, 0, 0, 1, 0, 0] },
      ],
    },
  },
  {
    id: 'hookFirst',
    label: 'HOOK-FIRST',
    description: 'Modern pop: open on the chorus, verses fill the space between hooks',
    structures: {
      short: [
        { roles: ['chorus', 'verse'], sequence: [0, 1, 1, 0] },
      ],
      long: [
        // C V V C B C C
        { roles: ['chorus', 'verse', 'bridge'], sequence: [0, 1, 1, 0, 2, 0, 0] },
        { roles: ['chorus', 'verse', 'refrain'], sequence: [0, 1, 2, 1, 2, 0, 0] },
      ],
      epic: [
        { roles: ['chorus', 'verse', 'contrast', 'bridge'], sequence: [0, 1, 1, 0, 2, 0, 3, 0, 0] },
        { roles: ['chorus', 'verse', 'breakdown', 'refrain'], sequence: [0, 1, 3, 0, 1, 2, 3, 0, 0] },
      ],
    },
  },
  {
    id: 'buildDrop',
    label: 'BUILD-DROP',
    description: 'Dance arrangement: groove, build, drop, strip back, do it again',
    structures: {
      short: [
        { roles: ['verse', 'bridge', 'climax'], sequence: [0, 1, 2, 2] },
      ],
      long: [
        { roles: ['verse', 'bridge', 'climax', 'breakdown'], sequence: [0, 0, 1, 2, 2, 3, 1, 2, 2] },
        { roles: ['verse', 'bridge', 'climax'], sequence: [0, 1, 2, 2, 0, 1, 2, 2] },
      ],
      epic: [
        { roles: ['verse', 'bridge', 'climax', 'breakdown'], sequence: [0, 0, 1, 2, 2, 3, 3, 1, 2, 2, 0] },
        { roles: ['verse', 'bridge', 'climax', 'breakdown'], sequence: [0, 1, 2, 2, 3, 1, 2, 2, 2, 0] },
      ],
    },
  },
  {
    id: 'loop',
    label: 'LOOP',
    description: 'Hypnotic repetition with slow variation — lo-fi, dub, minimal',
    structures: {
      short: [
        { roles: ['verse', 'contrast'], sequence: [0, 0, 1, 0] },
      ],
      long: [
        { roles: ['verse', 'contrast', 'breakdown'], sequence: [0, 0, 1, 0, 2, 0, 1, 0] },
        { roles: ['verse', 'contrast', 'bridge'], sequence: [0, 0, 0, 1, 0, 2, 1, 0] },
      ],
      epic: [
        { roles: ['verse', 'contrast', 'breakdown', 'bridge'], sequence: [0, 0, 1, 0, 2, 0, 1, 3, 0, 1, 0] },
        { roles: ['verse', 'contrast', 'breakdown'], sequence: [0, 0, 1, 0, 0, 2, 1, 0, 1, 0, 0] },
      ],
    },
  },
  {
    id: 'through',
    label: 'THROUGH-COMPOSED',
    description: 'Minimal repetition: each section is new material — prog and film-score energy',
    structures: {
      short: [
        { roles: ['verse', 'contrast', 'chorus'], sequence: [0, 1, 2, 2] },
      ],
      long: [
        { roles: ['verse', 'contrast', 'bridge', 'chorus'], sequence: [0, 1, 2, 3, 0, 3] },
        { roles: ['verse', 'contrast', 'breakdown', 'climax'], sequence: [0, 1, 2, 3, 1, 3] },
      ],
      epic: [
        { roles: ['verse', 'contrast', 'bridge', 'chorus', 'refrain'], sequence: [0, 1, 2, 3, 4, 1, 3, 3] },
        { roles: ['verse', 'contrast', 'bridge', 'breakdown', 'climax'], sequence: [0, 1, 2, 0, 3, 1, 4, 4, 2, 4] },
      ],
    },
  },
];

export function findStructure(id: string | null | undefined): StructureOption | null {
  if (!id) return null;
  return STRUCTURE_OPTIONS.find((s) => s.id === id) ?? null;
}
