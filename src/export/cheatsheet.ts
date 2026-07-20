// README.txt written into the exported Polyend project zip.
//
// The moment after export is the one where a beginner is most lost: an SD card
// full of unfamiliar files, eight tracks of somebody else's arrangement, and an
// FX column of two-letter codes. This describes the project in plain language
// while they are looking at the hardware, so the export teaches instead of
// just landing.
import { CHANNELS, isDrumChannel } from '../engine/types';
import type { EffectCode, NoteEffect, PatternLabel, Song, VibeName } from '../engine/types';
import { chordDisplayName } from '../engine/chords';
import { findStructure } from '../engine/structures';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

// Same names the app shows, duplicated rather than imported: store.ts pulls in
// the whole app, and the exporter should not depend on it.
const VIBE_LABELS: Record<VibeName, string> = {
  adventure: 'ADVENTURE',
  battle: 'BATTLE',
  dungeon: 'DUNGEON',
  titleScreen: 'TITLE',
  boss: 'BOSS',
  synthwave: 'SYNTHWAVE',
  house: 'HOUSE',
  techno: 'TECHNO',
  dub: 'DUB',
  idm: 'IDM',
  hardcore: 'HARDCORE',
  dnb: 'DNB',
  lofi: 'LO-FI',
  funk: 'FUNK',
  punk: 'PUNK',
};

/** One paragraph per genre: what makes it sound like itself, on this device. */
const VIBE_NOTES: Record<VibeName, string> = {
  adventure:
    'Bright major-key melody over a walking bass. The tune carries the track, so the drums stay out of its way.',
  battle:
    'Fast, minor, and busy. Driving eighth-note bass under a melody that keeps moving — urgency comes from density, not volume.',
  dungeon:
    'Slow, sparse and minor. The space between notes is the point; a dungeon theme that never stops breathing is not tense.',
  titleScreen:
    'Wide, slow chords and a simple memorable line. Built to loop forever without wearing out.',
  boss:
    'Minor and relentless, usually harmonic minor for that raised seventh. Everything pushes forward at once.',
  synthwave:
    'Retro-futurist: a looping minor progression that never resolves, offbeat bass, and gated-sounding chords. It feels like driving rather than arriving.',
  house:
    'Four-on-the-floor kick, offbeat open hats, bass tucked between the kicks. The groove lives in what is NOT on the downbeat.',
  techno:
    'Hypnotic and stripped back. One idea repeated with small changes — the kick is the song, everything else is decoration.',
  dub: 'Slow, heavy bass and huge gaps. Notes are sparse so the echoes have somewhere to go; on the device, add delay and reverb per track.',
  idm: 'Broken, shifting rhythms and unusual note choices. Programmed to be slightly wrong on purpose.',
  hardcore:
    'Very fast and distorted, with a kick doing most of the harmonic work. Simple lines, extreme energy.',
  dnb: 'A fast breakbeat (roughly 170 BPM) over a half-time bassline, so it feels quick and slow at the same time.',
  lofi: 'Slow, swung, and slightly out of tune on purpose. Imperfection is the aesthetic — resist tidying it up.',
  funk: 'Syncopation everywhere. The bass and the drums lock into one part; the gaps are as important as the hits.',
  punk: 'Fast, loud, three chords, no ornament. Energy over polish.',
};

/** What each generator effect becomes on the device — and what it sounds like. */
const FX_NOTES: Record<EffectCode, { polyend: string; what: string }> = {
  SU: { polyend: 'Slide Up', what: 'bends the pitch upward from the note — a rising sweep' },
  SD: { polyend: 'Slide Down', what: 'bends the pitch downward — a falling sweep or drop' },
  ST: { polyend: 'Gate Length', what: 'cuts the note short, making it clipped and staccato' },
  BC: { polyend: 'Bit Depth', what: 'crushes the sample to fewer bits — dirty and lo-fi' },
  VB: { polyend: 'Finetune LFO', what: 'wobbles the pitch continuously — vibrato' },
  TR: { polyend: 'Volume LFO', what: 'pulses the volume — tremolo' },
  CN: {
    polyend: 'Chance',
    what: 'a percentage chance the note plays at all, re-rolled every loop, so the pattern keeps changing on the device',
  },
  DT: { polyend: '', what: 'duty-cycle change (a pulse-width timbre shift)' },
  PD: { polyend: '', what: 'a fast downward pitch drop at the start of the note' },
};

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function wrap(text: string, width = 76): string {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.length <= width) {
      out.push(paragraph);
      continue;
    }
    let line = '';
    for (const word of paragraph.split(' ')) {
      if (line && line.length + word.length + 1 > width) {
        out.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) out.push(line);
  }
  return out.join('\n');
}

function heading(text: string): string {
  return `${text}\n${'-'.repeat(text.length)}`;
}

/** Wrap with a hanging indent so continuation lines stay under the text. */
function bullet(marker: string, text: string, width = 76): string {
  const indent = ' '.repeat(marker.length);
  return wrap(text, width - marker.length)
    .split('\n')
    .map((line, i) => (i === 0 ? marker : indent) + line)
    .join('\n');
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/**
 * Roman numerals carry chord quality by case: I is major, i is minor, i° is
 * diminished. Teaching them uppercase-only would teach them wrong, so take the
 * quality from the chord name we already computed.
 */
function romanNumeral(degree: number, name: string): string {
  const base = ROMAN[degree % 7] ?? '?';
  if (name.endsWith('°')) return `${base.toLowerCase()}°`;
  if (name.endsWith('m')) return base.toLowerCase();
  return base;
}

/** Rows in a pattern, read from the data rather than the config. */
function patternRows(song: Song, label: PatternLabel): number {
  return Math.max(0, (song.patterns[label]?.[0]?.length ?? 2) - 2);
}

function songSeconds(song: Song): number {
  const secondsPerRow = 60 / song.config.bpm / 4; // a row is a 16th note
  return song.sequence.reduce((total, idx) => {
    const label = song.patternOrder[idx];
    return total + (label ? patternRows(song, label) * secondsPerRow : 0);
  }, 0);
}

/** Which effect codes actually appear, and how many times. */
function usedEffects(song: Song): Map<EffectCode, number> {
  const counts = new Map<EffectCode, number>();
  for (const label of song.patternOrder) {
    for (const channel of song.patternEffects?.[label] ?? []) {
      for (const fx of channel ?? []) {
        if (fx) counts.set(fx.code, (counts.get(fx.code) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/** Channels carrying at least one note anywhere in the song. */
function activeChannels(song: Song): boolean[] {
  return CHANNELS.map((_, ch) =>
    song.patternOrder.some((label) =>
      (song.patterns[label]?.[ch] ?? []).slice(2).some((note) => note > 0)
    )
  );
}

function trackTable(song: Song): string {
  const active = activeChannels(song);
  const lines = CHANNELS.map((channel, ch) => {
    const slot = String(ch + 1).padStart(2, '0');
    const role = isDrumChannel(ch) ? 'one-shot drum' : 'pitched';
    const state = active[ch] ? role : 'empty in this song';
    return `  Track ${ch + 1}  ${channel.label.padEnd(5)}  instrument ${slot}  (${state})`;
  });
  return lines.join('\n');
}

function chordSection(song: Song): string {
  const { key, scale } = song.config;
  const lines: string[] = [];
  for (const label of song.patternOrder) {
    const degrees = song.patternChords?.[label];
    if (!degrees?.length) continue;
    const role = song.patternRoles[label] ?? 'verse';
    const named = degrees
      .map((d) => {
        const chord = chordDisplayName(d, key, scale);
        return `${romanNumeral(d, chord)} ${chord}`;
      })
      .join('  ->  ');
    lines.push(`  ${label} (${role}): ${named}`);
  }
  if (!lines.length) return '';
  return [
    heading('THE CHORDS'),
    '',
    wrap(
      `Everything is in ${key} ${scale}. Roman numerals count up the scale, so the same progression works in any key — this is how musicians write them down. Capitals are major chords, lowercase are minor, and ° is diminished.`
    ),
    '',
    ...lines,
  ].join('\n');
}

function fxSection(song: Song): string {
  const counts = usedEffects(song);
  if (counts.size === 0) return '';

  const mapped: string[] = [];
  const dropped: string[] = [];
  for (const [code, count] of [...counts].sort((a, b) => b[1] - a[1])) {
    const note = FX_NOTES[code];
    if (!note) continue;
    if (note.polyend) {
      mapped.push(
        bullet(`  ${note.polyend.padEnd(14)} `, `${note.what} (${plural(count, 'step')})`)
      );
    } else {
      dropped.push(`  ${note.what}`);
    }
  }

  const out = [heading('THE FX COLUMN')];
  if (mapped.length) {
    out.push(
      wrap(
        'These are real Polyend FX, written into the pattern steps. Select a step and open the FX column to see them:'
      ),
      mapped.join('\n')
    );
  }
  if (counts.has('CN')) {
    out.push(
      wrap(
        'Chance is the interesting one: those steps are not fixed. The device rolls the dice every time the pattern loops, so the track keeps varying while it plays. Try raising or lowering the percentage.'
      )
    );
  }
  if (dropped.length) {
    out.push(
      wrap(
        `${dropped.length === 1 ? 'One effect' : `${dropped.length} effects`} the app uses ${
          dropped.length === 1 ? 'has' : 'have'
        } no equivalent on sample-based hardware, so ${
          dropped.length === 1 ? 'it was' : 'they were'
        } left out rather than faked. If the export sounds slightly cleaner than the app, this is why:`
      ),
      dropped.join('\n')
    );
  }
  return out.join('\n\n');
}

function grooveSection(song: Song): string {
  const swing = song.config.swing ?? 0;
  const humanize = song.config.humanize ?? 0;
  if (!swing && !humanize) return '';
  const lines = [heading('GROOVE')];
  if (swing) {
    lines.push(
      wrap(
        `Swing ${swing}%: every second 16th step carries a Micro-move FX that nudges it late. That delay is the whole difference between a groove and a grid.`
      )
    );
  }
  if (humanize) {
    lines.push(
      wrap(
        `Humanize ${humanize}%: each step got a slightly random Volume/Velocity value, so repeated hits are not identical. Machines are perfect; players are not.`
      )
    );
  }
  return lines.join('\n\n');
}

export function buildProjectReadme(song: Song, trackCount: number): string {
  const { name, vibe, key, scale, bpm } = song.config;
  const label = VIBE_LABELS[vibe] ?? vibe.toUpperCase();
  const rows = patternRows(song, song.patternOrder[0]);
  const structure = findStructure(song.structureId);
  const active = activeChannels(song);
  const emptyCount = active.filter((a) => !a).length;

  const arrangement = song.sequence
    .map((idx) => song.patternOrder[idx] ?? '?')
    .join(' ');

  const title = name.toUpperCase();

  // Each entry is a self-contained block; blank lines come from the join, so
  // an omitted section leaves no gap behind.
  const blocks = [
    `${title}\n${'='.repeat(Math.max(3, title.length))}`,
    wrap(
      `Generated with polygen-tracker. ${label} — ${key} ${scale}, ${bpm} BPM, ${rows} rows per pattern, about ${fmtTime(songSeconds(song))} long.`
    ),
    wrap(VIBE_NOTES[vibe] ?? ''),

    heading('LOADING IT'),
    wrap(
      "Unzip this folder onto the SD card, into the Tracker's projects folder, then load it from the device. Keep the folder intact: the project file points at the pattern and instrument files by name, so renaming or moving them will break it."
    ),
    wrap(
      `The patterns are written for ${trackCount} tracks. If the device shows empty or missing tracks, the project was exported for a different firmware — re-export choosing 8 (firmware 1.8 and earlier), 12 (firmware 1.9+) or 16 (Tracker+ / Mini).`
    ),

    heading('THE TRACKS'),
    wrap(
      'Each track has its own instrument in the matching slot, rendered as a sample. The three drum tracks are one-shots that always trigger at the same pitch; the pitched tracks are repitched from the note column.'
    ),
    trackTable(song),
    emptyCount
      ? wrap(
          `${emptyCount} of the eight tracks are empty in this song. That is deliberate — arrangements breathe because things are missing. They are free space if you want to add a part.`
        )
      : '',

    heading('THE ARRANGEMENT'),
    `  Playlist: ${arrangement}\n` +
      song.patternOrder
        .map((patternLabel) => `  ${patternLabel} = ${song.patternRoles[patternLabel] ?? 'verse'}`)
        .join('\n'),
    structure ? wrap(`Form: ${structure.label} — ${structure.description}.`) : '',

    chordSection(song),
    fxSection(song),
    grooveSection(song),

    heading('THINGS TO TRY FIRST'),
    wrap(
      'The point of this project is to be taken apart. In rough order of how much you learn per minute:'
    ),
    [
      bullet(
        '  1. ',
        'Mute tracks while it plays. Find out which one the song actually depends on — it is rarely the melody.'
      ),
      bullet('  2. ', 'Delete every second hi-hat step. Notice how much space that opens up.'),
      bullet(
        '  3. ',
        'Change one instrument to a sample of your own. Same notes, completely different track.'
      ),
      bullet('  4. ', 'Copy a pattern, then change only the melody. That is how a variation is written.'),
      bullet(
        '  5. ',
        'Put a Chance FX around 50 on a few steps and let it loop. The pattern stops being fixed.'
      ),
    ].join('\n'),
    wrap('Nothing here is precious. It was generated in a second and can be generated again.'),
  ];

  return blocks.filter((block) => block.trim() !== '').join('\n\n') + '\n';
}
