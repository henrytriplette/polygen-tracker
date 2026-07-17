// Minimal Standard MIDI File (type 1) export.
// Timing: one pattern row = a 16th note = 24 ticks at 96 PPQ.
// Pitch: zzfxm note 12 = C4 = MIDI 60, so midi = zzfxm + 48.
import type { Song } from '../engine';

const PPQ = 96;
const TICKS_PER_ROW = PPQ / 4;
const ROWS = 32;

const TRACK_NAMES = ['Lead', 'Harmony', 'Bass', 'Drums'];
const GM_DRUMS = { kick: 36, snare: 38, hat: 42 };

interface MidiEvent {
  tick: number;
  bytes: number[];
  order: number; // note-offs before note-ons at the same tick
}

function vlq(value: number): number[] {
  const out = [value & 0x7f];
  value >>= 7;
  while (value > 0) {
    out.unshift((value & 0x7f) | 0x80);
    value >>= 7;
  }
  return out;
}

function str(text: string): number[] {
  return [...text].map((c) => c.charCodeAt(0));
}

function trackChunk(events: MidiEvent[]): number[] {
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const body: number[] = [];
  let lastTick = 0;
  for (const ev of events) {
    body.push(...vlq(ev.tick - lastTick), ...ev.bytes);
    lastTick = ev.tick;
  }
  body.push(0x00, 0xff, 0x2f, 0x00); // end of track
  const header = [...str('MTrk'),
    (body.length >> 24) & 0xff, (body.length >> 16) & 0xff, (body.length >> 8) & 0xff, body.length & 0xff];
  return [...header, ...body];
}

function drumMidiNote(zzfxmNote: number): number {
  if (zzfxmNote <= 6) return GM_DRUMS.kick;
  if (zzfxmNote <= 22) return GM_DRUMS.snare;
  return GM_DRUMS.hat;
}

export function buildMidiFile(song: Song): Blob {
  const humanize = Math.max(0, Math.min(30, song.config.humanize ?? 0));
  const velocity = () => Math.max(1, 100 - Math.round(Math.random() * humanize));

  // Track 0: tempo + song name
  const usPerQuarter = Math.round(60000000 / song.config.bpm);
  const meta: MidiEvent[] = [
    { tick: 0, order: 0, bytes: [0xff, 0x03, song.config.name.length & 0x7f, ...str(song.config.name)] },
    { tick: 0, order: 1, bytes: [0xff, 0x51, 0x03, (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff] },
  ];

  const channelTracks: MidiEvent[][] = [[], [], [], []];
  for (let ch = 0; ch < 4; ch++) {
    channelTracks[ch].push({
      tick: 0,
      order: 0,
      bytes: [0xff, 0x03, TRACK_NAMES[ch].length & 0x7f, ...str(TRACK_NAMES[ch])],
    });
  }

  song.sequence.forEach((patternIdx, seqPos) => {
    const label = song.patternOrder[patternIdx];
    const pattern = song.patterns[label];
    const baseTick = seqPos * ROWS * TICKS_PER_ROW;

    for (let ch = 0; ch < 4; ch++) {
      const midiChannel = ch === 3 ? 9 : ch; // GM drums live on channel 10
      const notes = pattern[ch].slice(2);

      for (let row = 0; row < ROWS; row++) {
        const note = notes[row];
        if (note <= 0) continue;

        const midiNote = ch === 3
          ? drumMidiNote(note)
          : Math.max(0, Math.min(127, Math.floor(note) + 48));

        // Duration: until the next note on this channel or the pattern end;
        // drums are always one row.
        let durRows = 1;
        if (ch !== 3) {
          durRows = ROWS - row;
          for (let next = row + 1; next < ROWS; next++) {
            if (notes[next] > 0) {
              durRows = next - row;
              break;
            }
          }
          durRows = Math.min(durRows, 8);
        }

        const onTick = baseTick + row * TICKS_PER_ROW;
        const offTick = onTick + durRows * TICKS_PER_ROW;
        channelTracks[ch].push({ tick: onTick, order: 1, bytes: [0x90 | midiChannel, midiNote, velocity()] });
        channelTracks[ch].push({ tick: offTick, order: 0, bytes: [0x80 | midiChannel, midiNote, 0] });
      }
    }
  });

  const chunks = [meta, ...channelTracks].map(trackChunk);
  const header = [
    ...str('MThd'), 0, 0, 0, 6,
    0, 1, // format 1
    0, chunks.length,
    (PPQ >> 8) & 0xff, PPQ & 0xff,
  ];

  const bytes = new Uint8Array([...header, ...chunks.flat()]);
  return new Blob([bytes], { type: 'audio/midi' });
}
