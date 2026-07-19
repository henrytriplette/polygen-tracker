# polygen-tracker

A generative chiptune tracker PWA that exports songs as **Polyend Tracker compatible projects**.

Click GENERATE and get a complete 8-channel song — lead, chords, bass, kick, snare, hat, arpeggio and pad — built algorithmically from 15 vibe templates spanning game music, electronic genres and classics. Audition it in the browser, edit notes and sounds by hand, then export the whole thing as a project folder you can drop straight onto a Polyend Tracker's SD card.

## Features

**Generation**
- **15 vibes** in a grouped dropdown — GAME (Adventure, Battle, Dungeon, Title Screen, Boss), ELECTRONIC (Synthwave, House, Techno, Dub, IDM, Hardcore, DnB), CLASSICS (Lo-Fi, Funk, Punk). Each carries its own chord progressions, drum templates, bass style, instrument palette, effects and song-name generator
- **Selectable song structures** — VERSE-CHORUS, VERSE-REFRAIN, AABA, HOOK-FIRST, BUILD-DROP, LOOP, THROUGH-COMPOSED, or AUTO for the vibe's own genre forms
- **Markov generation** for melody and harmony (see [Markov generation](#markov-generation))
- **Per-channel vibes, algorithms and sounds** — mix genres per instrument
- **Variable pattern length** — 16 / 32 / 64 / 128 rows
- **Seeded generation** — reproducible songs from a typed seed

**Editing**
- Tracker-style **note and FX editing** with scale-snapping
- **Block editing** — select, copy/cut/paste, clear and transpose across channels and patterns; duplicate a pattern
- **Chord bar** — edit the progression directly; harmony and bass follow
- **Instrument editor** — 20 ZzFX parameters with a live ADSR curve
- **Arrangement editing** — reorder the song chain, add patterns
- **MUTATE** and **RESAMPLE** for variations (see [Mutate vs Resample](#mutate-vs-resample))
- **Undo/redo** (Ctrl+Z / Ctrl+Y, 64 steps)

**Playback & output**
- Live WebAudio playback via ZzFX/ZzFXM (~1KB synth), per-channel mute/solo, playhead, follow mode, oscilloscope
- **Polyend project export** (`.mt` + `.mtp` + `.pti`), **patterns-only export**, **WAV**, **8 per-channel stems**, **MIDI**
- **Persistence** — autosave, named projects, `.polygen.json` files, shareable URLs
- **PWA** — installable, works offline

---

## How it works

### Channels

Eight channels, matching the Polyend's eight audio tracks:

| # | Channel | Role |
|---|---|---|
| 1 | LEAD | melody |
| 2 | HARM | chords |
| 3 | BASS | bass |
| 4–6 | KICK / SNR / HAT | drums, one track each |
| 7 | ARP | arpeggio / counter-melody |
| 8 | PAD | sustained chord bed |

Each drum has its own channel, so a kick and hat can sound on the same row. Channels map 1:1 onto tracks and instrument slots on export — nothing is merged or remapped.

Every channel header in the grid has three dropdowns:

- **VIBE** — `SONG` follows the song's vibe, or pick any of the 15 to give that one instrument its own genre (house drums under a dungeon lead, funk bass, lo-fi chords). Key, scale and BPM stay global so everything remains locked together.
- **ALGO** — the pattern generator (see below). `AUTO` uses the vibe's default.
- **SOUND** — the timbre archetype. `AUTO` picks one weighted by the vibe.

Plus **M** (mute), **S** (solo), **↻** (regenerate this channel in this pattern — it will also *populate* a channel the section role would normally silence) and **↻\*** (regenerate it in every pattern).

### Pattern algorithms

| Channel | Options |
|---|---|
| LEAD | WALK · ARP · RIFF · MARKOV · MARKOV-LEARN |
| HARM | GAPFILL · STABS · ARP · PEDAL |
| BASS | GROOVE · ACID · ARP · OFFBEAT |
| KICK/SNR/HAT | TEMPLATE · EUCLID · BREAK · 4-FLOOR |
| ARP | UP-DOWN · OCTAVES · RANDOM |
| PAD | SUSTAIN · SWELL · STAB |

The three drum channels share one kit generator, so changing any of them re-rolls the whole kit and keeps the parts rhythmically coherent.

### Pattern length

A row is always a 16th note, so length changes how long a pattern **runs**, not how fast it plays. Content therefore repeats at its natural period rather than stretching:

- 8-slot rhythm figures (melody, bass, harmony) cycle every **8 rows**
- Drum templates cycle every **32 rows** — 64 tiles the kit twice, 128 four times, 16 truncates it
- The chord progression always divides the pattern into **four equal segments**, so a 128-row pattern holds each chord for eight beats

The result: a 64-row pattern is the same groove over twice the space, not a half-time smear. Exports declare the real track length, so the hardware plays it back at the right size.

### The chord bar

Each pattern's four-chord progression is shown as roman-numeral + chord-name selects (`I · C`, `VI · Am`). Change any chord and **harmony, bass, arp and pad regenerate to follow it** while your lead stays untouched. Channel regeneration reuses the stored progression, so channels never drift apart harmonically.

**🎲 ROLL** generates a new progression. The **POOL / MARKOV** selector controls how:

- **POOL** — pick from the vibe's curated progressions (retrowave `i-VI-III-VII`, jazzy `ii-V-I`, three-chord punk, techno drones…)
- **MARKOV** — walk that vibe's harmonic transition chain

### Markov generation

Two of the LEAD algorithms replace template-based melody with a chain over scale degrees.

**MARKOV** needs no input. Each new note is drawn from "given the last interval, what usually comes next", using interval weights baked in per vibe — techno, dub and lo-fi mostly repeat and step; IDM and boss leap around; adventure moves stepwise. Two rules keep the walk musical:

- **Gap fill** — after a leap, the line usually steps back the other way
- **Chord-tone anchoring** — on block downbeats it slides to the *nearest* chord tone, so the harmony reads clearly without the line jumping registers

**MARKOV-LEARN** builds its transition table from the lead **already in the pattern**: it counts which interval tends to follow which in your existing melody, then generates new notes drawn from those same statistics. Same contour vocabulary, different tune. When learning, chord-snapping is dialled down to 15% — the source's own relationship to the harmony is already encoded in its intervals, and frequent snapping would punch holes in the character being reproduced.

> **Note:** MARKOV-LEARN only has something to learn from when regenerating a channel on an existing pattern. Pressing **GENERATE** builds patterns from scratch, so there is no prior lead and it falls back to the vibe's priors — behaving exactly like MARKOV. For an explicit "learn from this melody" action, use **RESAMPLE**.

### Mutate vs Resample

Two different kinds of variation, both in the header:

- **🧬 MUTATE** — nudges a few notes and drum hits, keeping the same tune. Lead notes move to scale neighbours, a harmony or arp note swaps to a different chord tone, a bass note flips between root and fifth, one drum ghost is added or removed.
- **⛓ RESAMPLE** — keeps the same *voice* and writes a new tune. It learns the melodic dialect of the selected pattern's lead and generates a fresh line from those statistics. It always learns, whatever the channel's ALGO is set to, and greys out when the lead is too sparse (fewer than four notes).

Repeated RESAMPLE presses re-learn from whatever the last press produced, so the character drifts over generations — photocopy of a photocopy. Undo (Ctrl+Z) back to the original if you want each variation measured against the same source.

### Editing notes and effects

Click any cell to place the cursor, then type:

| Key | Action |
|---|---|
| `Z`–`M` | notes in the current octave (FastTracker layout) |
| `Q`–`U` | one octave up |
| `1` | place a hit (on a drum channel) |
| `1`–`8` | place SU/SD/VB/DT/ST/PD/BC/TR (in an FX column) |
| `+` / `-` | octave up/down — or FX value in an FX column |
| `Del` | clear |
| arrows | move the cursor across rows and columns |
| `Esc` | drop the selection, then leave edit mode |

**Block editing** — select a rectangle and operate on all of it:

| Key | Action |
|---|---|
| `Shift`+arrows | extend the selection (shift+click also works) |
| `Ctrl`+`A` | select the channel, again for the whole pattern |
| `Ctrl`+`C` / `X` / `V` | copy / cut / paste at the cursor |
| `Del` | clear the whole selection |
| `Ctrl`+`↑`/`↓` | transpose by a semitone |
| `Ctrl`+`Shift`+`↑`/`↓` | transpose by an octave |

Paste puts the block's top-left corner at the cursor, so you can move material between channels and patterns. Pitched notes pasted onto a drum channel become hits (and vice versa), since a pitch means nothing there. Transpose skips drum channels for the same reason. **⧉ DUP** in the sequence bar clones the selected pattern into a new slot, so you can vary a copy without losing the original.

Entered notes are auditioned instantly and hot-swapped into playback. **SNAP** in the edit bar keeps entered notes inside the song's key and scale.

### Instrument editor

A collapsible panel with a tab per channel that follows the grid cursor. Twenty ZzFX parameters grouped into **TONE / ENVELOPE / MOTION / TEXTURE**, shown in real units (ms, Hz, %, waveform names) with a live ADSR curve drawn in the channel's colour. Plus:

- **▶** audition the instrument
- **🎲** new random timbre, keeping every note
- **🔒** lock the sound so GENERATE and vibe changes can't replace it

### Transport

Space play/stop · Ctrl+G generate · Ctrl+Z / Ctrl+Y undo/redo · 👁 follow mode tracks the playing pattern.

---

## Polyend export details

- One `.pti` per channel (`01 Lead` … `08 Pad`), and pattern track N = channel N
- The song fills all **8 audio tracks**
- Pitch mapping: zzfxm note 12 = C4 = Polyend note byte 48. Melodic samples are rendered at base pitch and repitched by the hardware; drum tracks always trigger at C4 (one-shot)
- Generator note effects map to native step FX where an equivalent exists (Slide Up/Down, Gate Length, Bit Depth, Finetune/Volume LFO); duty-cycle and pitch-drop effects play clean
- **Swing** exports as Micro-move step FX, **humanize** as Volume step FX
- Device selector for pattern track slots: **12** (original Tracker on firmware 1.9+, 8 audio + 4 MIDI — default), **8** (original Tracker on firmware ≤ 1.8), or **16** (Tracker+ / Mini)
- Unzip into `/Projects` on the SD card

Other exports: **patterns-only** (flat zip of `pattern_XX.mtp` for an existing project), **WAV** (full mix), **STEMS** (zip of 8 per-channel WAVs), **MIDI** (format-1, 8 named tracks, GM drums on channel 10), **JSON** (`.polygen.json`), and a **share URL** with the whole song deflate-compressed into the hash.

## Development

```bash
yarn
yarn dev      # dev server
yarn build    # typecheck + production build
```

### Structure

```
src/
  engine/
    song.ts          song assembly, regeneration, channel/chord application
    types.ts         channels, pattern length, section roles, shared types
    vibes.ts         per-vibe config and structure templates
    markov.ts        transition tables, melodic/harmonic styles, learning
    melody.ts        template melody + Markov melody
    harmony.ts bass.ts drums.ts altPatterns.ts   channel generators
    chords.ts        progressions, chord voicings
    instruments.ts   ZzFX instrument synthesis per channel
    instrumentParams.ts  editable parameter metadata + ADSR maths
    effects.ts       per-note effect placement
    zzfx.ts audioGraph.ts   synthesis and playback
  lib/polyend.ts     access layer over @polyend/tracker-lib
  export/            Polyend project zip, MIDI
  dev/roundtrip.ts   self-test: (await import('/src/dev/roundtrip.ts')).runRoundtrip()
  components/        Vue UI
  store.ts           app state, playback, actions
```

Polyend file I/O uses the [`@polyend/tracker-lib`](https://github.com/polyend/tracker-lib) npm package. Its public write helpers trigger one browser download per file, so `src/lib/polyend.ts` additionally exposes the package's internal serializer classes (via a `dist` alias in the Vite/TS config) to collect raw buffers for zip packaging — drop the alias once upstream exports buffer-returning writers.

## Ideas

[`IDEAS.md`](IDEAS.md) collects proposed features, framed around a beginner electronic musician using a Polyend Tracker — teaching aids, starting points, arrangement help and further generative algorithms.

## Credits

- Generation engine and ZzFXM player from [zzfx-studio](https://github.com/thejustinwalsh/zzfx-studio) by Justin Walsh (MIT)
- Polyend file I/O via [@polyend/tracker-lib](https://github.com/polyend/tracker-lib) (MIT)
- [ZzFX](https://github.com/KilledByAPixel/ZzFX) by Frank Force
