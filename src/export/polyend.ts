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
import { CHANNEL_COUNT, isDrumChannel } from '../engine/types';
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
   * Pattern file track slots (the song fills all 8 audio tracks):
   * - 8  = original Tracker on firmware <= 1.8 (8 audio tracks)
   * - 12 = original Tracker on firmware 1.9+ (8 audio + 4 MIDI) — default
   * - 16 = Tracker+ / Mini (8 audio + 8 MIDI)
   */
  trackCount?: 8 | 12 | 16;
}


const ZZFXM_TO_POLYEND = 36; // zzfxm note 12 (C4) -> Polyend note byte 48 (C4)
const POLYEND_C4 = 48;

// Channels map 1:1 onto the Polyend's audio tracks and instrument slots.
const CHANNEL_EXPORT_NAMES = ['Lead', 'Harmony', 'Bass', 'Kick', 'Snare', 'Hat', 'Arp', 'Pad'];

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


function setStep(step: StepData, note: number, instrument: number, effect: NoteEffect | null | undefined): void {
  step.note = Math.max(0, Math.min(127, note));
  step.instrument = instrument;
  if (effect) {
    const mapped = mapEffect(effect);
    if (mapped) step.fx[0] = mapped;
  }
}

/**
 * Convert one generated pattern into tracker-lib PatternData
 * (see https://polyend.github.io/tracker-lib/#creating-and-writing-a-pattern).
 */
export function buildPatternData(
  song: Song,
  label: Song['patternOrder'][number],
  trackCount: number,
): ReturnType<typeof Tracker.createPattern> {
  const source = song.patterns[label];
  const effects = song.patternEffects?.[label];
  const ROWS = Math.max(1, (source[0]?.length ?? 34) - 2);
  const pattern = Tracker.createPattern(trackCount, ROWS);

  const swing = Math.max(0, Math.min(30, song.config.swing ?? 0));
  const humanize = Math.max(0, Math.min(30, song.config.humanize ?? 0));
  const noneFx = PatternFX[0]!;

  const channels = Math.min(CHANNEL_COUNT, trackCount);
  for (let ch = 0; ch < channels; ch++) {
    const channelData = source[ch];
    if (!channelData) continue;
    const channelEffects = effects?.[ch];
    const track = pattern.tracks[ch];

    for (let row = 0; row < ROWS; row++) {
      const note = channelData[row + 2];
      if (note <= 0) continue;
      const step = track.steps[row];
      const effect = channelEffects?.[row] ?? null;

      // Drums are one-shot samples: always trigger at the sample's base pitch.
      const polyendNote = isDrumChannel(ch) ? POLYEND_C4 : note + ZZFXM_TO_POLYEND;
      setStep(step, polyendNote, ch, effect);

      // Groove FX in whichever step-FX slots remain free:
      // swing = Micro-move on odd 16ths, humanize = randomized Volume.
      const freeSlot = () => step.fx.findIndex((f) => f.type.index === noneFx.index);
      if (swing > 0 && row % 2 === 1) {
        const slot = freeSlot();
        if (slot >= 0) step.fx[slot] = { type: fxByName('Micro-move'), value: Math.min(100, Math.round(swing)) };
      }
      if (humanize > 0) {
        const slot = freeSlot();
        if (slot >= 0) {
          const vol = 100 - Math.round(Math.random() * humanize);
          step.fx[slot] = { type: fxByName('Volume/Velocity'), value: Math.max(0, Math.min(100, vol)) };
        }
      }
    }
  }

  return pattern;
}

/** Zip containing only the pattern files (pattern_01.mtp, ...), no project/instruments. */
export async function buildPatternsZip(song: Song, options: PolyendExportOptions = {}): Promise<Blob> {
  const trackCount = options.trackCount ?? 12;
  const zip = new JSZip();

  song.patternOrder.forEach((label, patternIdx) => {
    const pattern = buildPatternData(song, label, trackCount);
    zip.file(`pattern_${String(patternIdx + 1).padStart(2, '0')}.mtp`, Pattern.write(pattern));
  });

  return zip.generateAsync({ type: 'blob' });
}

export async function buildPolyendProjectZip(song: Song, options: PolyendExportOptions = {}): Promise<Blob> {
  const trackCount = options.trackCount ?? 12;
  const zip = new JSZip();

  // --- Instruments ------------------------------------------------------
  // One .pti per channel, rendered at its base pitch; the hardware repitches
  // melodic samples from the note column and plays drums one-shot.
  CHANNEL_EXPORT_NAMES.forEach((name, ch) => {
    const params = song.instruments[ch];
    if (!params) return;
    const wav = renderInstrumentWav(params, 12);
    const inst = Tracker.createInstrument(wav);
    inst.sample.filename = name;
    zip.file(
      `instruments/${String(ch + 1).padStart(2, '0')} ${name}.pti`,
      Instrument.write(inst)
    );
  });

  // --- Patterns ---------------------------------------------------------
  const patternNames: string[] = [];

  song.patternOrder.forEach((label, patternIdx) => {
    const pattern = buildPatternData(song, label, trackCount);
    const role = song.patternRoles[label] ?? 'verse';
    patternNames.push(`${label} ${role}`.substring(0, 30));
    zip.file(`patterns/pattern_${String(patternIdx + 1).padStart(2, '0')}.mtp`, Pattern.write(pattern));
  });

  zip.file('patterns/patternsMetadata', Metadata.writePatternsMetadata(Tracker.createPatternsMetadata(patternNames)));

  // --- Project ----------------------------------------------------------
  const project = Tracker.createProject(song.config.name || 'polygen');
  project.values.globalTempo = song.config.bpm;
  project.values.trackNames = [
    ...CHANNEL_EXPORT_NAMES,
    ...project.values.trackNames.slice(CHANNEL_EXPORT_NAMES.length),
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

function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export async function downloadPolyendProject(song: Song, options: PolyendExportOptions = {}): Promise<void> {
  const blob = await buildPolyendProjectZip(song, options);
  downloadBlob(blob, `${sanitizeProjectName(song.config.name)}.zip`);
}

export async function downloadPolyendPatterns(song: Song, options: PolyendExportOptions = {}): Promise<void> {
  const blob = await buildPatternsZip(song, options);
  downloadBlob(blob, `${sanitizeProjectName(song.config.name)}-patterns.zip`);
}
