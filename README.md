# polygen-tracker

A generative chiptune tracker PWA that exports songs as **Polyend Tracker compatible projects**.

Click GENERATE and get a complete 4-channel retro song — lead, harmony, bass, and drums — built algorithmically from vibe templates (Adventure, Battle, Dungeon, Title Screen, Boss). Audition it in the browser, tweak key/scale/BPM, regenerate individual patterns or channels, then export the whole thing as a project folder you can drop straight onto a Polyend Tracker's SD card.

## Features

- **Instant song generation** — drums (kick templates + probability), bass (Euclidean rhythms), melody (constrained random walk with motifs), harmony (arpeggiated chord tones), all locked to the chosen key/scale
- **5 vibe templates** with song structures (verse/contrast/bridge/breakdown/climax) in short/long/epic lengths
- **Live playback** — WebAudio rendering via ZzFX/ZzFXM (~1KB synth), per-channel mute/solo, playhead in the grid
- **Per-pattern and per-channel regeneration** — keep what you like, reroll the rest
- **Polyend Tracker export** — a zip containing `project.mt`, `patterns/*.mtp` + `patternsMetadata`, and `instruments/*.pti` with the ZzFX instruments rendered to samples (lead/harmony/bass at C4, drums split into kick/snare/hat). Unzip into `/Projects` on the SD card.
- **WAV export** of the full mix
- **PWA** — installable, works offline

## Polyend export details

- Pitch mapping: zzfxm note 12 = C4 = Polyend note byte 48; melodic samples are rendered at base pitch and repitched by the hardware
- Generator note effects are mapped to native step FX where an equivalent exists (Slide Up/Down, Gate Length, Bit Depth, Finetune/Volume LFO); duty-cycle and pitch-drop effects play clean
- Device selector for pattern track slots: 12 (original Tracker on firmware 1.9+, 8 audio + 4 MIDI — default), 8 (original Tracker on firmware ≤ 1.8), or 16 (Tracker+ / Mini). The song itself always uses tracks 1–4.

## Development

```bash
yarn
yarn dev      # dev server
yarn build    # typecheck + production build
```

### Structure

```
src/
  engine/        generation + playback engine (ported from zzfx-studio, MIT)
  lib/polyend.ts access layer over @polyend/tracker-lib (npm) — public API plus
                 the internal buffer-returning serializers via a dist alias
  export/        song -> Polyend project zip
  dev/           roundtrip self-test: (await import('/src/dev/roundtrip.ts')).runRoundtrip()
  components/    Vue UI
  store.ts       app state, playback, actions
```

Polyend file I/O uses the [`@polyend/tracker-lib`](https://github.com/polyend/tracker-lib) npm package. Its public write helpers trigger one browser download per file, so `src/lib/polyend.ts` additionally exposes the package's internal serializer classes (via a `dist` alias in the Vite/TS config) to collect raw buffers for zip packaging — drop the alias once upstream exports buffer-returning writers.

## Credits

- Generation engine and ZzFXM player from [zzfx-studio](https://github.com/thejustinwalsh/zzfx-studio) by Justin Walsh (MIT)
- Polyend file I/O via [@polyend/tracker-lib](https://github.com/polyend/tracker-lib) (MIT)
- [ZzFX](https://github.com/KilledByAPixel/ZzFX) by Frank Force
