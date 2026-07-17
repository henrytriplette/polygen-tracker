# polygen-tracker

A generative chiptune tracker PWA that exports songs as **Polyend Tracker compatible projects**.

Click GENERATE and get a complete 4-channel retro song — lead, harmony, bass, and drums — built algorithmically from vibe templates (Adventure, Battle, Dungeon, Title Screen, Boss). Audition it in the browser, tweak key/scale/BPM, regenerate individual patterns or channels, then export the whole thing as a project folder you can drop straight onto a Polyend Tracker's SD card.

## Features

- **Instant song generation** — drums (kick templates + probability), bass (Euclidean rhythms), melody (constrained random walk with motifs), harmony (arpeggiated chord tones), all locked to the chosen key/scale
- **Selectable song structures** — AUTO uses each vibe's own genre forms, or pick a named structure that works with any vibe: VERSE-CHORUS, VERSE-REFRAIN, AABA (32-bar), HOOK-FIRST (opens on the chorus), BUILD-DROP, LOOP, or THROUGH-COMPOSED. Section roles now include **chorus** (denser hook, ×1.3 melody) and **refrain** (prominent lead line over thinned backing) alongside verse/contrast/bridge/breakdown/climax
- **15 vibe templates** in short/long/epic lengths, picked from a grouped dropdown — GAME (Adventure, Battle, Dungeon, Title Screen, Boss), ELECTRONIC (Synthwave, House, Techno, Dub, IDM, Hardcore, DnB), and CLASSICS (Lo-Fi hip-hop, Funk, Punk). Each has genre-authentic structure (verse–chorus, build–drop, hypnotic loops, dub versions with dropouts, vamps), chord progressions (retrowave i-VI-III-VII, jazzy ii-V-I, techno drones, hoover riffs…), drum templates (four-on-the-floor, one-drop, two-step breaks, euclidean IDM scatters, gabber kick walls), bass style, instrument palette, effects, and song-name generator.
- **Live playback** — WebAudio rendering via ZzFX/ZzFXM (~1KB synth), per-channel mute/solo, playhead in the grid
- **Per-pattern and per-channel regeneration** — keep what you like, reroll the rest
- **Note editing** — click any note cell and type tracker-style: `Z`–`M` play the current octave (`Q`–`U` one up, FastTracker layout), `1/2/3` place kick/snare/hat on the drum track, `Del` clears, `+`/`-` shifts octave, arrows move the cursor, `Esc` exits. Entered notes are auditioned instantly and hot-swapped into playback. Scale-snapping (toggleable in the edit bar) keeps entered notes in the song's key/scale
- **Chord generator** — each pattern's 4-chord progression (one per 8 rows) is shown in a chord bar with roman-numeral + chord-name selects; edit any chord or ROLL a new progression, and harmony + bass regenerate to follow while your lead stays untouched. Channel regeneration also reuses the stored progression, so channels never drift apart harmonically
- **Per-channel vibe overrides** — give each instrument its own genre (e.g. house drums under a dungeon lead, funk bass, lo-fi chords). The channel takes its pattern style, density, instrument sound, and effects from its own vibe; chord-progression flavor follows the harmony channel; key/scale/BPM stay global so everything remains locked together
- **Per-channel pattern algorithms** — besides the vibe default (AUTO), each channel has selectable generators: lead WALK / ARP (chord arpeggios) / RIFF (transposed ostinato); harmony GAPFILL / STABS (offbeat skanks) / ARP (C64-style) / PEDAL; bass GROOVE / ACID (16th lines with octave jumps) / ARP (root-fifth-octave) / OFFBEAT (house pump); drums TEMPLATE / EUCLID (euclidean kit) / BREAK (breakbeat skeletons) / 4-FLOOR
- **Polyend Tracker export** — a zip containing `project.mt`, `patterns/*.mtp` + `patternsMetadata`, and `instruments/*.pti` with the ZzFX instruments rendered to samples (lead/harmony/bass at C4, drums split into kick/snare/hat). Unzip into `/Projects` on the SD card.
- **Patterns-only export** — a flat zip of `pattern_XX.mtp` files (via tracker-lib's pattern writer) to drop into an existing project's `patterns` folder
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
