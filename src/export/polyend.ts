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
import { CH_HAT, CH_KICK, CH_SNARE, CHANNEL_COUNT, isDrumChannel } from '../engine/types';
import type { Song, NoteEffect } from '../engine/types';
import {
  AudioUtil,
  Instrument,
  InstrumentPlayMode,
  Metadata,
  Pattern,
  PatternFX,
  Project,
  Tracker,
  type FX,
  type StepData,
} from '../lib/polyend';
import { buildDrumKit, sliceForChannel } from './drumKit';
import { buildProjectReadme } from './cheatsheet';
import { channelInstrumentSettings } from './instrumentSettings';
import { projectMixSettings } from './projectSettings';
import { mapEffect } from './fxMap';

export interface PolyendExportOptions {
  /**
   * Pattern file track slots (the song fills all 8 audio tracks):
   * - 8  = original Tracker on firmware <= 1.8 (8 audio tracks)
   * - 12 = original Tracker on firmware 1.9+ (8 audio + 4 MIDI) — default
   * - 16 = Tracker+ / Mini (8 audio + 8 MIDI)
   */
  trackCount?: 8 | 12 | 16;
  /**
   * How the three drum channels become instruments.
   * - 'separate' = one .pti each (default, and what older exports did)
   * - 'sliced'   = one sliced .pti triggered by the Slice FX, freeing two
   *                instrument slots on a device that has a finite sample bank
   */
  drumKit?: 'separate' | 'sliced';
}


const ZZFXM_TO_POLYEND = 36; // zzfxm note 12 (C4) -> Polyend note byte 48 (C4)
const POLYEND_C4 = 48;

// Channels map 1:1 onto the Polyend's audio tracks and instrument slots.
const CHANNEL_EXPORT_NAMES = ['Lead', 'Harmony', 'Bass', 'Kick', 'Snare', 'Hat', 'Arp', 'Pad'];

/**
 * Render one instrument, normalized to a consistent peak.
 *
 * Gain staging happens here rather than in the instrument's volume field.
 * ZzFX renders peak well below full scale, so the boost needed to level them
 * would exceed the device's volume range (0..2) and every channel would
 * saturate at the ceiling, erasing the mix. Normalizing the samples also uses
 * the 16-bit depth properly instead of wasting headroom.
 */
const EXPORT_PEAK = 0.89; // just under full scale, leaving room for filter ripple

function renderInstrumentWav(params: number[], zzfxmNote: number): { wav: ArrayBuffer; peak: number } {
  const p = [...params];
  p[2] = (p[2] ?? 0) * 2 ** ((zzfxmNote - 12) / 12);
  const samples = ZZFX.buildSamples(...p);

  let peak = 0;
  for (const sample of samples) {
    const abs = sample < 0 ? -sample : sample;
    if (abs > peak) peak = abs;
  }

  // A silent render is left alone; scaling it would only amplify nothing.
  const normalized = new Float32Array(samples.length);
  const gain = peak > 1e-4 ? EXPORT_PEAK / peak : 1;
  for (let i = 0; i < samples.length; i++) normalized[i] = samples[i] * gain;

  return {
    wav: AudioUtil.createWavFile(normalized, {
      numChannels: 1,
      sampleRate: ZZFX.sampleRate,
      bitsPerSample: 16,
    }),
    peak,
  };
}

function fxByName(name: string): FX['type'] {
  const record = PatternFX.find((fx) => fx.name === name);
  if (!record) throw new Error(`Unknown Polyend FX: ${name}`);
  return record;
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
  drumKit: 'separate' | 'sliced' = 'separate',
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

      // With a sliced kit all three drum tracks share one instrument and are
      // told apart by the Slice FX, so it has to be written before anything
      // else can claim a slot — without it the wrong drum fires.
      const slice = drumKit === 'sliced' ? sliceForChannel(ch) : null;
      const instrument = slice === null ? ch : CH_KICK;
      setStep(step, polyendNote, instrument, effect);

      const freeSlot = () => step.fx.findIndex((f) => f.type.index === noneFx.index);
      if (slice !== null) {
        const slot = step.fx[0].type.index === noneFx.index ? 0 : freeSlot();
        if (slot >= 0) step.fx[slot] = { type: fxByName('Slice'), value: slice };
      }

      // Groove FX in whichever step-FX slots remain free:
      // swing = Micro-move on odd 16ths, humanize = randomized Volume.
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
  const drumKit = options.drumKit ?? 'separate';
  const zip = new JSZip();

  song.patternOrder.forEach((label, patternIdx) => {
    const pattern = buildPatternData(song, label, trackCount, drumKit);
    zip.file(`pattern_${String(patternIdx + 1).padStart(2, '0')}.mtp`, Pattern.write(pattern));
  });

  zip.file('README.txt', buildProjectReadme(song, trackCount));

  return zip.generateAsync({ type: 'blob' });
}

export async function buildPolyendProjectZip(song: Song, options: PolyendExportOptions = {}): Promise<Blob> {
  const trackCount = options.trackCount ?? 12;
  const drumKit = options.drumKit ?? 'separate';
  const zip = new JSZip();

  // --- Instruments ------------------------------------------------------
  // One .pti per channel, rendered at its base pitch; the hardware repitches
  // melodic samples from the note column and plays drums one-shot.
  const kit = drumKit === 'sliced' ? buildDrumKit(song) : null;

  CHANNEL_EXPORT_NAMES.forEach((name, ch) => {
    // A sliced kit occupies the kick's slot and replaces the snare and hat
    // instruments entirely, freeing two slots in the sample bank.
    if (kit && (ch === CH_SNARE || ch === CH_HAT)) return;

    if (kit && ch === CH_KICK) {
      const inst = Tracker.createInstrument(kit.wav);
      inst.sample.filename = 'Drums';
      Object.assign(inst, channelInstrumentSettings(song, CH_KICK, kit.peak));
      inst.playmode = InstrumentPlayMode.Slice;
      inst.numSlices = kit.sliceCount;
      kit.slicePoints.forEach((point, index) => {
        inst.slices[index] = point;
      });
      zip.file(`instruments/${String(ch + 1).padStart(2, '0')} Drums.pti`, Instrument.write(inst));
      return;
    }

    const params = song.instruments[ch];
    if (!params) return;
    const { wav, peak } = renderInstrumentWav(params, 12);
    const inst = Tracker.createInstrument(wav);
    inst.sample.filename = name;

    // Mixer settings: gain staging, stereo placement, sends and filtering.
    // Without these every instrument lands at unity, centred and dry.
    Object.assign(inst, channelInstrumentSettings(song, ch, peak));

    zip.file(
      `instruments/${String(ch + 1).padStart(2, '0')} ${name}.pti`,
      Instrument.write(inst)
    );
  });

  // --- Patterns ---------------------------------------------------------
  const patternNames: string[] = [];

  song.patternOrder.forEach((label, patternIdx) => {
    const pattern = buildPatternData(song, label, trackCount, drumKit);
    const role = song.patternRoles[label] ?? 'verse';
    patternNames.push(`${label} ${role}`.substring(0, 30));
    zip.file(`patterns/pattern_${String(patternIdx + 1).padStart(2, '0')}.mtp`, Pattern.write(pattern));
  });

  zip.file('patterns/patternsMetadata', Metadata.writePatternsMetadata(Tracker.createPatternsMetadata(patternNames)));

  // --- Project ----------------------------------------------------------
  const project = Tracker.createProject(song.config.name || 'polygen');
  project.values.globalTempo = song.config.bpm;

  // Global send effects. Instrument sends do nothing until these are unmuted
  // and given a level, so the two settings must travel together.
  Object.assign(project.values, projectMixSettings(song));
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

  // Plain-language guide to what just landed on the SD card. The device
  // ignores unknown files, so it rides along harmlessly.
  zip.file('README.txt', buildProjectReadme(song, trackCount));

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
