// Export a generated Song as a Polyend Tracker compatible project.
//
// Produced zip layout (matches the on-device project folder):
//   project.mt
//   patterns/pattern_01.mtp ... pattern_NN.mtp  (1-based, matching playlist values)
//   patterns/patternsMetadata
//   instruments/01 Lead.pti ... (file number = step instrument byte + 1)
//
// Pitch mapping: zzfxm note 12 plays the instrument at its base frequency
// (C4, 261.63 Hz). Samples are rendered at that base pitch, and the Polyend
// note byte 48 is C4 (MIDI 60), so: polyendNote = zzfxmNote + 36.
import JSZip from 'jszip';
import { ZZFX } from '../engine/zzfx';
import type { Song, NoteEffect } from '../engine/types';
import {
  AudioUtil,
  Instrument,
  Metadata,
  Pattern,
  PatternFX,
  Project,
  Tracker,
  type FX,
  type StepData,
} from '../lib/polyend';

export interface PolyendExportOptions {
  /**
   * Pattern file track slots (the generated song always uses tracks 1-4):
   * - 8  = original Tracker on firmware <= 1.8 (8 audio tracks)
   * - 12 = original Tracker on firmware 1.9+ (8 audio + 4 MIDI) — default
   * - 16 = Tracker+ / Mini (8 audio + 8 MIDI)
   */
  trackCount?: 8 | 12 | 16;
}

const ROWS = 32;
const ZZFXM_TO_POLYEND = 36; // zzfxm note 12 (C4) -> Polyend note byte 48 (C4)
const POLYEND_C4 = 48;

// Drum channel notes are pitch variations of one noise instrument; export
// them as three dedicated samples so the hardware plays them faithfully.
const DRUM_SPLITS = [
  { name: 'Kick', zzfxmNote: 1, maxNote: 6 },
  { name: 'Snare', zzfxmNote: 14, maxNote: 22 },
  { name: 'Hat', zzfxmNote: 32, maxNote: Infinity },
] as const;

const CHANNEL_NAMES = ['Lead', 'Harmony', 'Bass'] as const;

function renderInstrumentWav(params: number[], zzfxmNote: number): ArrayBuffer {
  const p = [...params];
  p[2] = (p[2] ?? 0) * 2 ** ((zzfxmNote - 12) / 12);
  const samples = ZZFX.buildSamples(...p);
  return AudioUtil.createWavFile(new Float32Array(samples), {
    numChannels: 1,
    sampleRate: ZZFX.sampleRate,
    bitsPerSample: 16,
  });
}

function fxByName(name: string): FX['type'] {
  const record = PatternFX.find((fx) => fx.name === name);
  if (!record) throw new Error(`Unknown Polyend FX: ${name}`);
  return record;
}

// Map the generator's per-note effects onto native Polyend step FX where a
// meaningful equivalent exists. Unmapped effects simply play clean.
function mapEffect(effect: NoteEffect): FX | null {
  const v = effect.value;
  switch (effect.code) {
    case 'SU': // slide up, both are 0-255 pitch sweeps
      return { type: fxByName('Slide Up'), value: Math.min(255, v) };
    case 'SD':
      return { type: fxByName('Slide Down'), value: Math.min(255, v) };
    case 'ST': {
      // Staccato -> Gate Length %. Generator shortens the envelope by up to 85%.
      const gate = Math.round((1 - (v / 255) * 0.85) * 100);
      return { type: fxByName('Gate Length'), value: Math.max(5, Math.min(100, gate)) };
    }
    case 'BC': {
      // Bit crush -> Bit Depth (16 clean .. 1 destroyed). Keep it musical.
      const depth = Math.round(16 - (v / 255) * 12);
      return { type: fxByName('Bit Depth'), value: Math.max(4, Math.min(16, depth)) };
    }
    case 'VB': {
      // Vibrato -> Finetune LFO amount (approximation).
      const depth = (v & 0xf) || 1;
      return { type: fxByName('Finetune LFO'), value: Math.min(30, depth * 2) };
    }
    case 'TR': {
      // Tremolo -> Volume LFO amount (approximation).
      const depth = (v & 0xf) || 1;
      return { type: fxByName('Volume LFO'), value: Math.min(24, Math.max(1, Math.round((depth / 15) * 24))) };
    }
    default:
      // DT (duty cycle) and PD (pitch drop) have no sample-based equivalent.
      return null;
  }
}

function drumSplitIndex(zzfxmNote: number): number {
  return DRUM_SPLITS.findIndex((d) => zzfxmNote <= d.maxNote);
}

function setStep(step: StepData, note: number, instrument: number, effect: NoteEffect | null | undefined): void {
  step.note = Math.max(0, Math.min(127, note));
  step.instrument = instrument;
  if (effect) {
    const mapped = mapEffect(effect);
    if (mapped) step.fx[0] = mapped;
  }
}

export async function buildPolyendProjectZip(song: Song, options: PolyendExportOptions = {}): Promise<Blob> {
  const trackCount = options.trackCount ?? 12;
  const zip = new JSZip();

  // --- Instruments ------------------------------------------------------
  // 0..2 = lead/harmony/bass rendered at base pitch, 3..5 = kick/snare/hat.
  const instrumentFiles: { filename: string; buffer: ArrayBuffer }[] = [];

  CHANNEL_NAMES.forEach((name, i) => {
    const wav = renderInstrumentWav(song.instruments[i], 12);
    const inst = Tracker.createInstrument(wav);
    inst.sample.filename = name;
    instrumentFiles.push({ filename: `${String(i + 1).padStart(2, '0')} ${name}.pti`, buffer: Instrument.write(inst) });
  });

  DRUM_SPLITS.forEach((split, i) => {
    const wav = renderInstrumentWav(song.instruments[3], split.zzfxmNote);
    const inst = Tracker.createInstrument(wav);
    inst.sample.filename = split.name;
    instrumentFiles.push({
      filename: `${String(i + 4).padStart(2, '0')} ${split.name}.pti`,
      buffer: Instrument.write(inst),
    });
  });

  for (const file of instrumentFiles) {
    zip.file(`instruments/${file.filename}`, file.buffer);
  }

  // --- Patterns ---------------------------------------------------------
  const patternNames: string[] = [];

  song.patternOrder.forEach((label, patternIdx) => {
    const source = song.patterns[label];
    const effects = song.patternEffects?.[label];
    const pattern = Tracker.createPattern(trackCount, ROWS);

    for (let ch = 0; ch < 4; ch++) {
      const channelData = source[ch];
      const channelEffects = effects?.[ch];
      const track = pattern.tracks[ch];

      for (let row = 0; row < ROWS; row++) {
        const note = channelData[row + 2];
        if (note <= 0) continue;
        const step = track.steps[row];
        const effect = channelEffects?.[row] ?? null;

        if (ch === 3) {
          const split = drumSplitIndex(note);
          setStep(step, POLYEND_C4, 3 + split, effect);
        } else {
          setStep(step, note + ZZFXM_TO_POLYEND, ch, effect);
        }
      }
    }

    const role = song.patternRoles[label] ?? 'verse';
    patternNames.push(`${label} ${role}`.substring(0, 30));
    zip.file(`patterns/pattern_${String(patternIdx + 1).padStart(2, '0')}.mtp`, Pattern.write(pattern));
  });

  zip.file('patterns/patternsMetadata', Metadata.writePatternsMetadata(Tracker.createPatternsMetadata(patternNames)));

  // --- Project ----------------------------------------------------------
  const project = Tracker.createProject(song.config.name || 'polygen');
  project.values.globalTempo = song.config.bpm;
  project.values.trackNames = [
    'Lead',
    'Harmony',
    'Bass',
    'Drums',
    ...project.values.trackNames.slice(4),
  ];

  const playlist = new Array(project.song.playlist.length).fill(0);
  song.sequence.forEach((patternIdx, slot) => {
    if (slot < playlist.length) playlist[slot] = patternIdx + 1; // playlist is 1-based
  });
  project.song.playlist = playlist;
  project.song.playlistPos = 0;

  zip.file('project.mt', Project.write(project));

  return zip.generateAsync({ type: 'blob' });
}

export function sanitizeProjectName(name: string): string {
  // Polyend project folder names: alphanumeric, dash, plus, at, space.
  const cleaned = name.replace(/[^a-zA-Z0-9\-+@ ]/g, '').trim();
  return (cleaned || 'polygen-song').substring(0, 32);
}

export async function downloadPolyendProject(song: Song, options: PolyendExportOptions = {}): Promise<void> {
  const blob = await buildPolyendProjectZip(song, options);
  const name = sanitizeProjectName(song.config.name);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${name}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
