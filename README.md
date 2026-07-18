# polygen-tracker

A generative chiptune tracker PWA that exports songs as **Polyend Tracker compatible projects**.

Click GENERATE and get a complete 4-channel retro song — lead, harmony, bass, and drums — built algorithmically from vibe templates (Adventure, Battle, Dungeon, Title Screen, Boss). Audition it in the browser, tweak key/scale/BPM, regenerate individual patterns or channels, then export the whole thing as a project folder you can drop straight onto a Polyend Tracker's SD card.

## Features

- **Variable pattern length (16/32/64/128 rows)** — a row is a 16th note, so length changes how long a pattern *runs*, not how fast it plays. Content repeats at its natural period rather than stretching: the 8-slot rhythm figures cycle every 8 rows, drum templates every 32, and the chord progression always divides the pattern into four equal segments. Exports declare the real track length, so the hardware plays it back at the right size
- **8 channels, matching the Polyend's 8 audio tracks** — LEAD, HARM, BASS, KICK, SNR, HAT, ARP, PAD. Each drum gets its own track (so a kick and hat can sound on the same row), and the ARP/PAD channels fill out the arrangement. Channels map 1:1 onto tracks and instrument slots on export
- **Instant song generation** — drums (kick templates + probability), bass (Euclidean rhythms), melody (constrained random walk with motifs), harmony (arpeggiated chord tones), arpeggios and sustained pads, all locked to the chosen key/scale
- **Selectable song structures** — AUTO uses each vibe's own genre forms, or pick a named structure that works with any vibe: VERSE-CHORUS, VERSE-REFRAIN, AABA (32-bar), HOOK-FIRST (opens on the chorus), BUILD-DROP, LOOP, or THROUGH-COMPOSED. Section roles now include **chorus** (denser hook, ×1.3 melody) and **refrain** (prominent lead line over thinned backing) alongside verse/contrast/bridge/breakdown/climax
- **15 vibe templates** in short/long/epic lengths, picked from a grouped dropdown — GAME (Adventure, Battle, Dungeon, Title Screen, Boss), ELECTRONIC (Synthwave, House, Techno, Dub, IDM, Hardcore, DnB), and CLASSICS (Lo-Fi hip-hop, Funk, Punk). Each has genre-authentic structure (verse–chorus, build–drop, hypnotic loops, dub versions with dropouts, vamps), chord progressions (retrowave i-VI-III-VII, jazzy ii-V-I, techno drones, hoover riffs…), drum templates (four-on-the-floor, one-drop, two-step breaks, euclidean IDM scatters, gabber kick walls), bass style, instrument palette, effects, and song-name generator.
- **Live playback** — WebAudio rendering via ZzFX/ZzFXM (~1KB synth), per-channel mute/solo, playhead in the grid
- **Per-pattern and per-channel regeneration** — keep what you like, reroll the rest
- **Instrument editor** — a collapsible panel with a tab per channel (it follows the grid cursor). 20 ZzFX parameters grouped into TONE / ENVELOPE / MOTION / TEXTURE with labelled sliders and real units (ms, Hz, %, waveform names), a live ADSR curve drawn in the channel's colour, plus audition, timbre reroll, and a **lock** that pins a sound so GENERATE and vibe changes can't replace it. Every edit is auditioned instantly and hot-swapped into playback
- **Note editing** — click any note cell and type tracker-style: `Z`–`M` play the current octave (`Q`–`U` one up, FastTracker layout), `1/2/3` place kick/snare/hat on the drum track, `Del` clears, `+`/`-` shifts octave, arrows move the cursor, `Esc` exits. Entered notes are auditioned instantly and hot-swapped into playback. Scale-snapping (toggleable in the edit bar) keeps entered notes in the song's key/scale
- **Chord generator** — each pattern's 4-chord progression (one per 8 rows) is shown in a chord bar with roman-numeral + chord-name selects; edit any chord or ROLL a new progression, and harmony + bass regenerate to follow while your lead stays untouched. Channel regeneration also reuses the stored progression, so channels never drift apart harmonically
- **Per-channel vibe overrides** — give each instrument its own genre (e.g. house drums under a dungeon lead, funk bass, lo-fi chords). The channel takes its pattern style, density, instrument sound, and effects from its own vibe; chord-progression flavor follows the harmony channel; key/scale/BPM stay global so everything remains locked together
- **Per-channel pattern algorithms** — besides the vibe default (AUTO), each channel has selectable generators: lead WALK / ARP (chord arpeggios) / RIFF (transposed ostinato); harmony GAPFILL / STABS (offbeat skanks) / ARP (C64-style) / PEDAL; bass GROOVE / ACID (16th lines with octave jumps) / ARP (root-fifth-octave) / OFFBEAT (house pump); drums TEMPLATE / EUCLID (euclidean kit) / BREAK (breakbeat skeletons) / 4-FLOOR
- **Polyend Tracker export** — a zip containing `project.mt`, `patterns/*.mtp` + `patternsMetadata`, and `instruments/*.pti` with the ZzFX instruments rendered to samples (lead/harmony/bass at C4, drums split into kick/snare/hat). Unzip into `/Projects` on the SD card.
- **Patterns-only export** — a flat zip of `pattern_XX.mtp` files (via tracker-lib's pattern writer) to drop into an existing project's `patterns` folder
- **WAV export** of the full mix, **per-channel stems** (zip of 4 WAVs), and **MIDI export** (format-1, 4 named tracks, GM drums on channel 10)
- **Persistence** — the working song auto-saves to localStorage; named projects can be saved/loaded/deleted in the browser; songs export/import as `.polygen.json` files; **shareable URLs** pack the whole song deflate-compressed into the location hash
- **Undo/redo** (Ctrl+Z / Ctrl+Y, 64 steps) over every song change
- **Mutate** — small skeleton-preserving variation of the selected pattern (scale-neighbor nudges, chord-tone swaps, drum ghosts) instead of a full reroll
- **Seeded generation** — type a seed for reproducible songs; the last random seed is shown
- **Swing & humanize** — swing shifts odd 16ths in playback (pair-balanced renderer timing) and exports as Micro-move step FX; humanize adds random per-note velocity via zzfxm fractional-note attenuation and exports as Volume step FX
- **FX lane editing** — cursor moves into effect columns; keys 1-8 place SU/SD/VB/DT/ST/PD/BC/TR, +/- adjusts the value
- **Arrangement editing** — right-click a song slot to cycle its pattern, shift+click removes it, + appends, +PAT adds a new generated pattern (up to 8)
- **Per-channel regenerate** — ↻ regenerates (or populates, even in breakdowns) the channel in the selected pattern, ↻* across all patterns
- **Transport & workflow** — Space play/stop, Ctrl+G generate, follow mode (👁) tracks the playing pattern, oscilloscope in the header
- **`.mtp` import** — load a Polyend pattern file into the selected pattern (best effort mapping)
- **PWA** — installable, works offline

## Polyend export details

- One `.pti` per channel (`01 Lead` … `08 Pad`), and pattern track N = channel N, so nothing is merged or remapped
- Pitch mapping: zzfxm note 12 = C4 = Polyend note byte 48; melodic samples are rendered at base pitch and repitched by the hardware, while drum tracks always trigger at C4 (one-shot)
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
