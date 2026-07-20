# Ideas

Future features, framed around one specific user: **a beginner electronic musician who owns a Polyend Tracker.**

That person usually isn't blocked by a missing feature. They're blocked by a blank pattern, by not knowing why their loop sounds flat next to a record they love, and by a device whose FX column is full of single letters nobody explained. The most valuable things this tool can do are *give them a running start* and *quietly teach them why it works* — not add more knobs.

Each idea below notes what it is and why it helps. Nothing here is committed to; it's a menu.

For the opposite user — someone already fluent on the device, who wants the machine exposed rather than hidden — see [IDEAS-ADVANCED.md](IDEAS-ADVANCED.md).

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

- ~~**Exported cheat-sheet**~~ — *done.* Both export zips carry a `README.txt` describing the genre, the track/instrument map, the arrangement, the chords in roman numerals, every FX actually used, the groove settings and five things to try first. It also names the empty tracks as deliberate space rather than omissions.
- **FX column decoder** — a reference panel mapping Polyend's single-letter FX to what they audibly do, with examples drawn from the current song's own patterns. *Partly covered by the exported cheat-sheet, but only for FX the song happens to use, and only after export.*
- ~~**"What changed on export" notes**~~ — *done*, as part of the cheat-sheet: it names duty-cycle and pitch-drop as the two effects with no sample-based equivalent, so a cleaner-sounding export is explained rather than mysterious.
- **Device-shaped constraints preview** — warn when a song uses more instruments or longer patterns than the target firmware supports, before the export lands on the SD card.

## 4. Arrangement help

Beginners can usually make a good 8-bar loop and then stall. This is where a generative tool has the most to give.

- ★ **Tension curve** — a drawable energy envelope across the song that modulates density, register and effect budget continuously, rather than only per section role. Makes long patterns breathe and teaches that arrangement *is* energy management.
- **Arrangement coach** — non-judgemental observations: "every section has all 8 channels playing — try muting the pad in the verse", "your chorus isn't denser than your verse". Rules of thumb, phrased as suggestions.
- **Song duration display** — you currently can't tell how long a track is without exporting it. Trivial, and beginners genuinely care ("is this long enough to be a track?"). *The exported cheat-sheet now states the duration, so the calculation exists; it just isn't in the UI yet.*
- **A/B snapshot** — stash the current version, try something, toggle between them. Teaches critical listening more than any explanation.

## 5. More generative algorithms

Beyond the Markov chains already in place.

- ~~**Per-step chance**~~ — *done.* `CN` effect, re-rolled per render and exported as the Polyend's native Chance FX, so the project stays generative on the device.
- ~~**L-system lead**~~ — *done.*
- ~~**Cellular-automata drums**~~ — *done*, using rules 90/110/18. Rules 30 and 150 were tried and dropped: they are chaotic enough that roughly half the cells are alive at any moment, so the taps fire on nearly every row and the "beat" is a wall.
- ~~**Motif development**~~ — *done*, with transpose / invert / retrograde / augment.
- ~~**Polymeter figures**~~ — *done*, on the bass and arp channels.
- **Evolve** — spawn several mutations, audition, keep one, repeat. Selective breeding; MUTATE is already half of it.
- **Chance on generation** — a global amount that sprinkles `CN` during generation, so beginners meet the feature without having to find the FX lane.

## 6. Sound design without the fear

- **Preset library with descriptions** — instrument presets named for what they *are* ("dusty tape kick", "hoover stab") rather than parameter dumps. Beginners pick sounds by vibe, then learn the parameters by seeing what moved.
- **"Make it more…" nudges** — one-click transforms on the current instrument: *warmer*, *harder*, *dirtier*, *further away*. Each nudges several ZzFX parameters together, which is how a producer actually thinks.
- ~~**Parameter explanations in the instrument panel**~~ — *done.* Each group carries a one-line description of what it does to the sound, sitting above its sliders.
- ~~**Sample-length warnings**~~ — *done.* The panel shows the rendered sample's length and exported size, and warns when an instrument is silent, too short to read as a note, or long enough to eat sample memory (with a specific note for drums, which overlap their own next hit).

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
2. ~~Per-step chance~~ — **done**; keeps the export alive on the hardware.
3. ~~Exported cheat-sheet~~ — **done**; lands at the exact moment of confusion.
4. **Starter packs** — removes the blank page, and is a teaching artefact.
5. **Tension curve** — the arrangement lesson most people need after their first good loop.

The through-line: this tool is at its best when it hands someone a finished-sounding track they didn't know how to make, then shows them which lever produced which part of it.
