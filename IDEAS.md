# Ideas

Future features, framed around one specific user: **a beginner electronic musician who owns a Polyend Tracker.**

That person usually isn't blocked by a missing feature. They're blocked by a blank pattern, by not knowing why their loop sounds flat next to a record they love, and by a device whose FX column is full of single letters nobody explained. The most valuable things this tool can do are *give them a running start* and *quietly teach them why it works* — not add more knobs.

Each idea below notes what it is and why it helps. Nothing here is committed to; it's a menu.

---

## 1. Teach while it generates

The generator already makes musically-informed decisions. Right now it makes them silently. Surfacing the reasoning turns the tool into a tutor.

- **"Why this works" panel** — a short plain-language note about the current pattern: *"i–VI–III–VII: the retrowave loop. It never resolves, which is why it feels like driving rather than arriving."* Pulled from the vibe/progression that generated it, so it costs no analysis.
- **Theory tooltips on the chord bar** — hovering `V · G` explains what a dominant chord is and why it wants to fall to `I`. Beginners learn roman numerals by seeing them next to real chord names in a track they made.
- **Genre cheat-sheets** — pick TECHNO and get a collapsible card: typical BPM, the four-on-the-floor kick, offbeat hats, why the bassline sits between kicks, what makes it different from house. The data already exists in `vibes.ts`; this just exposes it as prose.
- **Annotate the grid** — optional markers showing *why* a note is where it is: "chord tone", "passing note", "ghost hit". Helps someone learn to read a pattern rather than just hear it.

## 2. Kill the blank page

- ★ **Starter packs** — a handful of curated, hand-checked songs per genre, loadable in one click and explicitly meant to be pulled apart. "Here is a finished techno track; delete things and see what breaks" is how most people actually learn a tracker.
- ★ **Batch generate** — spit out 8–12 songs at once, audition them fast, keep what sparks something. Suits the tool's identity better than one reroll at a time, and pairs with seeds so each keeper is reproducible.
- **Seed of the day** — one shared seed everyone gets. Low effort, gives beginners a common reference point and something to compare approaches on.
- **"Make me something like…"** — a few reference-flavoured presets (*late-night drive*, *warehouse basement*, *rainy afternoon*) that set vibe + BPM + scale + length together. Beginners think in moods, not in dorian mode at 128 BPM.

## 3. Explain the hardware, not just the song

The Tracker itself is a barrier. This app already knows the format intimately, so it's well placed to teach it.

- ★ **Exported cheat-sheet** — drop a `README.txt` into the exported project zip: which instrument is on which track, what the FX in the pattern do, how to load it on the device, what to try changing first. Costs almost nothing and lands exactly when the user is staring at unfamiliar hardware.
- **FX column decoder** — a reference panel mapping Polyend's single-letter FX to what they audibly do, with examples drawn from the current song's own patterns.
- **"What changed on export" notes** — flag the honest gaps: duty-cycle and pitch-drop effects don't survive to the hardware. Better to say so than let someone wonder why the export sounds different.
- **Device-shaped constraints preview** — warn when a song uses more instruments or longer patterns than the target firmware supports, before the export lands on the SD card.

## 4. Arrangement help

Beginners can usually make a good 8-bar loop and then stall. This is where a generative tool has the most to give.

- ★ **Tension curve** — a drawable energy envelope across the song that modulates density, register and effect budget continuously, rather than only per section role. Makes long patterns breathe and teaches that arrangement *is* energy management.
- **Arrangement coach** — non-judgemental observations: "every section has all 8 channels playing — try muting the pad in the verse", "your chorus isn't denser than your verse". Rules of thumb, phrased as suggestions.
- **Song duration display** — you currently can't tell how long a track is without exporting it. Trivial, and beginners genuinely care ("is this long enough to be a track?").
- **A/B snapshot** — stash the current version, try something, toggle between them. Teaches critical listening more than any explanation.

## 5. More generative algorithms

Beyond the Markov chains already in place.

- **Per-step chance** — Elektron-style trigger probability. The payoff here is unique: Polyend has a **native Chance FX**, so this exports losslessly and the *hardware itself* re-rolls every loop. The exported project stays generative on the device.
- **L-system lead** — a short motif expanded by rewrite rules (transpose, mirror, subdivide) into self-similar long-form lines. The 64/128-row patterns are currently filled by tiling an 8-row figure; this would give them real long-form material.
- **Cellular-automata drums** — Rule 90/110/30 evolving row by row, three cells mapped to kick/snare/hat, seeded from the vibe's template so bar 1 stays anchored. Excellent for IDM.
- **Motif development** — deterministic theme-and-variation: restate the opening phrase inverted, retrograde, augmented, transposed. Very "composed"-sounding for the effort.
- **Polymeter figures** — a 5- or 7-row bass loop against 4/4 drums. Trivial to generate, sounds instantly sophisticated, and teaches a genuinely useful tracker trick.
- **Evolve** — spawn several mutations, audition, keep one, repeat. Selective breeding; MUTATE is already half of it.

## 6. Sound design without the fear

- **Preset library with descriptions** — instrument presets named for what they *are* ("dusty tape kick", "hoover stab") rather than parameter dumps. Beginners pick sounds by vibe, then learn the parameters by seeing what moved.
- **"Make it more…" nudges** — one-click transforms on the current instrument: *warmer*, *harder*, *dirtier*, *further away*. Each nudges several ZzFX parameters together, which is how a producer actually thinks.
- **Parameter explanations in the instrument panel** — the tooltips exist; a short "what this does to the sound" line per group would go further.
- **Sample-length warnings** — flag instruments whose rendered sample is very long or short before they become `.pti` files.

## 7. Listening and feedback

- **Per-channel level meters** — see that the pad is drowning the lead. Mixing is invisible to beginners until something shows it to them.
- **Reference-track comparison** — load a track, show its rough tempo and energy shape next to the current song. Not analysis-for-analysis' sake: it answers "why does mine feel emptier?"
- **Solo-with-context** — solo a channel but keep the drums, which is how you actually check whether a part works.

## 8. Workflow and sharing

- ~~**Copy/paste and transpose**~~ — *done.* Block selection, copy/cut/paste, clear and semitone/octave transpose, plus pattern duplication.
- **Transpose by scale degree** — the current transpose moves by semitones, which can leave notes outside the key. A diatonic mode would keep everything in scale, which is what a beginner usually wants.
- **Interpolate an FX column** — fill values linearly between two rows. The classic way to make a filter sweep, and it teaches automation.
- **Full project import** — the app parses single `.mtp` files; loading a whole `.mt` project would make it a round-trip editor and let people bring device work back for variation.
- **Web MIDI input** — play notes in from a keyboard. Natural for this audience, and a nice PWA flex.
- **Live pattern queueing** — click a pattern while playing to queue it next, Ableton session-style. Turns the app into something you can perform with.

---

## Where I'd start

For this specific user, in order:

1. ~~Copy/paste + transpose~~ — **done**; cheap experimentation is how beginners learn.
2. **Exported cheat-sheet** — smallest effort, lands at the exact moment of confusion.
3. **Starter packs** — removes the blank page, and is a teaching artefact.
4. **Per-step chance** — genuinely novel, and keeps the export alive on the hardware.
5. **Tension curve** — the arrangement lesson most people need after their first good loop.

The through-line: this tool is at its best when it hands someone a finished-sounding track they didn't know how to make, then shows them which lever produced which part of it.
