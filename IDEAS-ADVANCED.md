# Ideas — advanced

The companion to [IDEAS.md](IDEAS.md), framed around a different person: **someone who already programs their Polyend Tracker fluently.**

That user is not blocked by a blank pattern and does not need a chord explained. They can write the loop faster by hand than they can describe it to a generator. What they cannot do by hand is explore a space — a thousand variations under a constraint, a process that runs longer than their patience, an idea that only becomes audible at scale. And what they *shouldn't* have to do by hand is the mechanical half of the job: gain staging eight rendered samples, transcribing a groove, filling an FX lane with a ramp.

So the value proposition inverts. For a beginner this tool is a tutor that hands them a finished track. For an expert it is two things:

1. **A compositional instrument** — processes they can steer, not presets they can pick.
2. **A compiler targeting the Tracker** — one that exploits the hardware fully and gets out of the way.

The second is where the tool is currently weakest, and it is measurable. Numbers below were read from the installed `@polyend/tracker-lib`, not assumed.

---

## 1. Determinism and provenance

An expert's core loop is *generate → judge → refine*. That loop breaks the moment a result can't be recovered.

- ★ **Seed everything, separately.** There is one global seed today. A per-channel and per-section seed means you can freeze the drums you like and keep rolling the lead — the single most useful operation in generative work, and currently impossible without regenerating the whole song.
- **Generation recipes as data.** Every song should carry the full recipe that produced it: algorithm per channel, seeds, constraint set, engine version. Reopening a project six months later should let you re-run it, not just replay its output.
- **Version-pinned generators.** If a generator's behaviour changes, old seeds stop reproducing. Either pin algorithm versions in the recipe or accept that seeds are only valid within a release — but say which.
- **Diffable project format.** The `.polygen` JSON is one line per song. Formatting it stably (sorted keys, one row per line) makes projects git-friendly, which is how this user already manages everything else.
- **A/B/C/D slots, not one snapshot.** Four parallel takes, switchable while playing.

## 2. Composition as constraint, not preset

The vibe list is a set of curated answers. An expert wants to state the *question*.

- ★ **Constraint-based generation.** Rather than picking TECHNO, specify: pitch-class set, register bounds per channel, maximum leap, density range, rhythmic grid, which beats must and must not be occupied. Then let the generator satisfy it. This is the single biggest structural change on this list, and it subsumes most of the vibe system — vibes become named constraint presets rather than a parallel mechanism.
- **Voice-leading rules as constraints.** Forbid parallel fifths, cap total voice movement, require common-tone retention between chords. The chord engine already computes triads; it just doesn't reason across them.
- **Negative constraints.** "Never this interval", "never on the downbeat", "this channel never plays while that one does". Exclusions shape a result far faster than positive rules.
- **Constraint solving over search.** A real solver (or even bounded backtracking) makes tight constraint sets satisfiable where rejection-sampling stalls. Worth it only if constraints land first.

## 3. A deeper algorithmic surface

Current generators: `walk · arp · riff · markov · markovLearn · lsystem · motif` for lead, plus euclidean, cellular-automata, break and polymeter variants elsewhere. Good coverage of *processes*, thin coverage of *composition between them*.

- ★ **Pattern algebra.** Make transformations first-class and composable: `retrograde(invert(transpose(motif, 3)))`, applied to a selection, saved as a named macro, reused across patterns. The transforms already exist inside `motif` — they just aren't addressable. This turns one-shot generators into a language.
- **Higher-order and variable-order Markov.** The chains are first-order, which is why learned melodies wander. Variable-order (or a suffix tree) captures phrase-level structure without hand-tuning.
- **Serial and set-theory operators.** Twelve-tone rows with the standard four transforms; pitch-class set operations. Niche, cheap to implement given the note representation, and genuinely generative in a way genre templates aren't.
- **Sieves.** Xenakis-style residue sieves generate rhythms that are periodic but not obviously so — the interesting middle ground between euclidean regularity and randomness.
- **Metric modulation and tempo automation.** The Tracker has a native Tempo FX (unused by the exporter). Ritardandi, half-time drops and modulations are all reachable and currently unreachable.
- **Generative FX lanes.** Automation as a first-class generated layer, not a per-note afterthought — see below, where this becomes the biggest single gap.

## 4. Exploit the export target

This is the section that matters most, and where the concrete gaps are largest. The device is far more capable than the exporter assumes.

- ★★ **Instrument parameters are almost entirely unwritten.** A `.pti` carries `cutoff`, `resonance`, `filterType`, `filterEnabled`, `tune`, `finetune`, `volume`, `panning`, `delaySend`, `reverbSend`, `overdrive`, `bitdepth`, `playmode`, loop points, **48 slice points**, a granular section, and **6 automation slots**. The exporter sets a sample and a filename. Everything else stays default. Writing filter, panning, sends and volume alone would make exports sit in a mix instead of arriving flat and centred.
- ★★ **32 of the 41 real FX are never emitted.** The format defines 43 FX types, two of which (`None`, `Off`) aren't effects. The exporter can emit nine: `Slide Up`, `Slide Down`, `Gate Length`, `Bit Depth`, `Finetune LFO`, `Volume LFO`, `Chance`, plus `Micro-move` and `Volume/Velocity` for groove. Unused and immediately valuable: `Roll`, `Arp`, `Glide`, `Reverse Playback`, `Low-pass`/`High-pass`/`Band-pass`, `Filter LFO`, `Panning`/`Panning LFO`, `Delay Send`, `Reverb Send`, `Slice`, `Position LFO`, `Tempo`, `Swing`, `Break Pattern`, `Random Note`/`Random Instrument`/`Random FX Value`.
- ★ **The random FX are the generative ones.** `Chance` already ships (and keeps an exported project alive on the device). `Random Note`, `Random Instrument` and `Random FX Value` do the same for pitch, timbre and modulation. Emitting these deliberately means the exported project keeps composing itself on the hardware — the most on-brand feature available, and it costs a mapping table. Note the honest limit: unlike `Chance`, a random *note* on the device is unconstrained, so the app's scale-snapping guarantees stop at the SD card unless the surrounding steps are chosen to absorb it.
- ★ **Both FX slots per step.** There are two; groove FX currently take whatever's free after the note effect. Deliberate allocation (one for pitch/time, one for timbre/space) roughly doubles the expressible per-step detail.
- **Tracks 9–16 are empty.** Patterns support 16 tracks; the song writes 8. On firmware 1.9+ the rest are MIDI, and there are `MIDI CC A`–`F` and `MIDI Chord` FX to drive them. Generating MIDI parts for outboard gear is a whole feature sitting behind a track-count change.
- **Global delay and reverb are unset.** The project exposes `delayFeedback`, `delayTime`, `delayParams`, `delayVolume`, `reverb`, `reverbVolume` and their mutes. A dub patch that arrives with the delay already dialled in is a different experience from one that arrives dry.
- **The playlist has 255 slots.** Songs use a handful. Long-form and generative arrangement have room the tool doesn't use.
- **Gain staging across instruments.** Eight independently rendered samples have no shared reference level. Normalising to a target peak — or better, matching perceived loudness — is mechanical work the tool is well placed to do and the user currently does on the device.

## 5. Round-trip

- ★ **Full `.mt` project import.** The app parses single `.mtp` files. Reading a whole project — patterns, playlist, instrument settings — makes this a round-trip tool: take device work, run processes over it, send it back. This is what turns the app from a generator into part of a workflow.
- **Import as a Markov corpus.** `markovLearn` learns from the current song. Pointing it at a folder of your own projects makes it learn *your* voice, which is the version of that feature worth having.
- **Non-destructive re-export.** Re-exporting over an edited project should preserve what you changed on the device and update only what the tool owns.

## 6. Scripting

At some point the right interface for this user is a text field, not a slider.

- ★ **An expression lane.** Per-step formulas over row/pattern/channel — `note = scale[(row * 3) % 7]`, `chance = 100 - row * 3`. Cheap to implement, enormously expressive, and it makes the FX-lane interpolation idea from IDEAS.md a special case rather than a feature.
- **User-defined generators.** A documented generator signature plus a place to paste one. The internal algorithms are already uniform enough to expose.
- **Headless generation.** A CLI that takes a recipe and emits a project. Batch generation, CI, cron-driven album generation, generative net-labels.
- **MIDI/OSC control.** Drive parameters from hardware while auditioning.

## 7. Analysis

Feedback the ear eventually gives you, given immediately.

- **Register and spectral collision.** Flag channels competing for the same range — the pad swallowing the lead is visible before it's audible.
- **Export lint.** Warn before the SD card, not after: unmapped FX that will silently vanish, sample memory totals, patterns exceeding the target firmware, instrument count. The cheat-sheet does a prose version of this already; an expert wants it as a blocking check.
- **Density and entropy over the arrangement.** A plot of note density, register spread and rhythmic entropy per section — an objective read on whether the arrangement actually develops.
- **Corpus statistics.** Compare a generated song's interval and rhythm distributions against your imported corpus. Answers "does this sound like me?" numerically.

## 8. Performance

- **Live pattern queueing** with quantised switching.
- **MIDI clock / Ableton Link** sync, so auditioning runs against everything else.
- **Parameter morphing** — interpolate between two instrument states over a number of patterns, exported as automation rather than performed live.

---

## Where I'd start

Ordered by value per unit of work, for this user:

1. **Write the instrument parameters** (§4). The data model is already there in `tracker-lib`; the exporter simply doesn't populate it. Largest audible improvement per line of code in the entire project.
2. **Map the rest of the FX table** (§4), starting with the random/generative ones. Mechanical, and it makes exports behave like the app.
3. **Per-channel seeds** (§1). Small change, immediately unlocks the freeze-and-reroll loop.
4. **Pattern algebra** (§3). Turns existing transforms into a language instead of a button.
5. **Full `.mt` import** (§5). The gateway to round-tripping, corpus learning, and non-destructive re-export.

The through-line, and the inversion of the beginner document: for a novice this tool should hide the machine and hand over a finished track. For an expert it should expose the machine completely — every FX slot, every instrument parameter, every seed — and then get out of the way.
