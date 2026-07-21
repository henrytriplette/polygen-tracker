# Ideas — advanced

The companion to [IDEAS.md](IDEAS.md), framed around a different person: **someone who already programs their Polyend Tracker fluently.**

That user is not blocked by a blank pattern and does not need a chord explained. They can write the loop faster by hand than they can describe it to a generator. What they cannot do by hand is explore a space — a thousand variations under a constraint, a process that runs longer than their patience, an idea that only becomes audible at scale. And what they *shouldn't* have to do by hand is the mechanical half of the job: gain staging eight rendered samples, transcribing a groove, filling an FX lane with a ramp.

So the value proposition inverts. For a beginner this tool is a tutor that hands them a finished track. For an expert it is two things:

1. **A compositional instrument** — processes they can steer, not presets they can pick.
2. **A compiler targeting the Tracker** — one that exploits the hardware fully and gets out of the way.

Numbers below were read from the installed `@polyend/tracker-lib`, not assumed.

### Sharpening it: inspiration, on the original Tracker

Two refinements change what matters most, and sections 9–12 follow from them.

**The output is inspiration, not a track.** This user finishes their own music. They do not want a completed song; they want raw material good enough to argue with. That has a concrete consequence the rest of this document missed: *the unit of output should be a fragment, not a song.* One bar that suggests something beats eight bars that resolve. Generating a whole arrangement is, for this person, mostly generating things they will delete.

**The target is the original Tracker.** Not the Tracker+ or Mini. Eight audio tracks, each monophonic — on firmware 1.9+ there are twelve tracks, but 9–12 are MIDI, so the audio budget is eight voices and no more. That is a design constraint to compose *into*, not route around: every generated part should assume it gets one mono voice and no chords, and the tool should say so when a part quietly assumes otherwise. The same constraint is why instrument slots and sample memory are worth spending carefully, which §12 takes seriously.

---

## 1. Determinism and provenance

An expert's core loop is *generate → judge → refine*. That loop breaks the moment a result can't be recovered.

- ~~**Seed everything, separately.**~~ — *done for channels.* Rerolling a channel records its seed on the song, so you can freeze what you like and keep rolling the rest, then replay any channel's last roll exactly. Note the remaining gap: whole-song generation still runs under one master seed with the channels interleaved, so a channel seed reproduces a *reroll*, not that channel's share of the original generation. Per-section seeds are still open.
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

- ~~**Pattern algebra.**~~ — *engine done.* Seven composable transforms (transpose, invert, retrograde, augment, diminish, rotate, thin) with `chain()` and named macros, applied to a block selection. Inversion mirrors about the row's midpoint rather than its lowest note, which keeps it involutive — composition has to be predictable to be worth calling an algebra. *Remaining: a palette UI so macros can be built by hand rather than in code.*
- **Higher-order and variable-order Markov.** The chains are first-order, which is why learned melodies wander. Variable-order (or a suffix tree) captures phrase-level structure without hand-tuning.
- **Serial and set-theory operators.** Twelve-tone rows with the standard four transforms; pitch-class set operations. Niche, cheap to implement given the note representation, and genuinely generative in a way genre templates aren't.
- **Sieves.** Xenakis-style residue sieves generate rhythms that are periodic but not obviously so — the interesting middle ground between euclidean regularity and randomness.
- **Metric modulation and tempo automation.** The Tracker has a native Tempo FX (unused by the exporter). Ritardandi, half-time drops and modulations are all reachable and currently unreachable.
- **Generative FX lanes.** Automation as a first-class generated layer, not a per-note afterthought — see below, where this becomes the biggest single gap.

## 4. Exploit the export target

This is the section that matters most, and where the concrete gaps are largest. The device is far more capable than the exporter assumes.

- ~~**Instrument parameters are almost entirely unwritten.**~~ — *largely done.* Exports now carry volume, panning, delay/reverb sends and per-channel filtering. **Still unwritten and valuable: the 6 automation slots** (each an envelope *and* an LFO with shape, speed and amount — a per-instrument modulation matrix), **48 slice points**, granular, and the loop points that `ForwardLoop`/`PingpongLoop` need.
- ~~**32 of the 41 real FX are never emitted.**~~ — *done.* Nineteen codes now map, including the generative ones. Values are clamped to each FX's own declared range, which matters because the library does not range-check: writing 200 to a 0–100 field stores 200, and writing 300 wraps to 44.
- ~~**The random FX are the generative ones.**~~ — *mapped.* `Random Note`, `Random Instrument` and `Random FX Value` now export. The honest limit stands: unlike `Chance`, a random *note* on the device is unconstrained, so the app's scale-snapping stops at the SD card. **Open idea: constrain it anyway** — pick the instrument's `tune` and the surrounding steps so that every pitch the device can randomly land on is still in key. Then the hardware improvises and cannot play a wrong note.
- ★ **Both FX slots per step.** There are two; groove FX currently take whatever's free after the note effect. Deliberate allocation (one for pitch/time, one for timbre/space) roughly doubles the expressible per-step detail.
- **Tracks 9–12 are MIDI, not spare audio.** *Correcting an earlier bullet here that lumped 9–16 together:* on the original Tracker the audio budget is eight voices, full stop. What tracks 9–12 unlock on firmware 1.9+ is sequencing outboard gear — with `MIDI CC A`–`F` and `MIDI Chord` — which is a genuinely different feature: the Tracker as the brain of a hardware setup, generating parts for synths it isn't rendering.
- ~~**Global delay and reverb are unset.**~~ — *done*, and tempo-synced: the delay time is derived from the song's BPM, since the exporter is the only place that knows it.
- **The playlist has 255 slots.** Songs use a handful — see §11, where this becomes a long-form generative idea rather than a capacity note.
- ~~**Gain staging across instruments.**~~ — *done*, by normalising the rendered audio rather than the volume field. Worth recording why: setting the device's `volume` to level the samples pinned every channel at the 2.0 ceiling, because ZzFX renders peak far below full scale and the required boost exceeded the field's range. Normalising the PCM also stops wasting 16-bit depth. *Still open: matching perceived loudness rather than peak — a sustained pad at the same peak as a kick is much louder.*

## 5. Round-trip

- ~~**Full `.mt` project import.**~~ — *done.* Notes, FX, playlist, tempo and pattern roles round-trip exactly. Two limits are reported to the user on import rather than hidden: instrument timbres cannot come back (a `.pti` is a rendered sample; there is no inverse to ZzFX parameters), and **pattern length has to be inferred** — a `.mtp` always stores 128 steps and records nowhere how many are in use, so a pattern with a deliberately empty tail imports shorter than it was written.
- ★ **Import as a Markov corpus.** `markovLearn` learns from the current song. Pointing it at a folder of your own projects makes it learn *your* voice, which is the version of that feature worth having — and now that whole projects import, this is the obvious next step rather than a distant one.
- **Non-destructive re-export.** Re-exporting over an edited project should preserve what you changed on the device and update only what the tool owns. Sharper now that import exists: the tool can diff what it generated against what came back, and touch only the tracks you didn't edit.

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

# Written for inspiration, on the original Tracker

Sections 1–8 treat the tool as a generator that happens to target hardware. These four start from the two refinements at the top: the output is *raw material*, and the target has *eight mono voices*.

## 9. The unit of output is a fragment

Generating a whole song and keeping one bar of it is a bad trade — you audition four minutes to find four seconds. Invert it.

- ★★ **A fragment bank.** One keypress produces sixteen one-bar ideas for a single channel under the current key and vibe. Audition them with the arrow keys, star the two that spark, discard the rest. The generator is already fast enough that the bottleneck is entirely the interface. This is the highest-value idea in this document for a user who writes their own music.
- ★★ **Export a palette project.** One `.mt` where every pattern is a different candidate idea rather than a section of one song. You take it to the device and audition on the speakers you actually use, in the room where you actually work — which is where this user makes decisions, not in a browser tab. The exporter already writes multi-pattern projects; this is a different *arrangement* of the same capability, not new machinery.
- ★ **Star, don't save.** Rating a fragment should cost one key and no dialog. A session's stars accumulate into a shelf you can pull from later.
- **Lineage.** Every fragment records what it came from — seed, algorithm, and any transforms applied. "The one two variations before that" becomes navigable instead of lost.
- **Auto-log every audition.** Nothing generated should be unrecoverable. A timestamped log of seeds costs almost nothing and removes the fear that makes people hoard takes.

## 10. Generate against what you already have

The most useful generative act is not "make me something" — it is "make me something that *fits this*". Full project import just made this reachable.

- ★★ **Complete the loop.** Load your in-progress project, lock the parts you have written, and generate only into the empty channels. A counter-melody that answers this bass. Hats that sit in the gaps this kick leaves. The generator already regenerates single channels; what it lacks is *conditioning* on the fixed ones, which is where the musical value is.
- ★★ **Fill the negative space.** Analyse which registers and which sixteenths are unoccupied, and generate specifically into them. A part that fits is mostly a part that goes where nothing else is — this is a rule the tool can actually apply, and it is exactly the judgement that gets harder the longer you stare at a loop.
- ★ **Reharmonise.** Keep the melody, propose five different chord beds under it. Cheap given the existing chord engine, and one of the fastest ways to make a part you are bored of sound new.
- ★ **Continue, don't repeat.** Given eight bars, generate bars 9–16 that *develop* the material — the motif transforms exist for this and are now composable.
- **Answer a phrase.** Call-and-response between two channels as an explicit mode: generate channel B as a reply to channel A rather than as an independent part.
- **Groove transplant.** Extract the microtiming and velocity shape of one part and impose it on another, so a stiff generated line inherits a groove you already like.

## 11. Provocation

Inspiration lives at the edge of a style, not its centre. A generator tuned only for idiomatic output is tuned to be unsurprising.

- ★★ **A deviation dial.** One control: how far from the idiom. At zero, textbook techno. At maximum, still coherent but strange — wrong-register bass, displaced downbeats, intervals the style avoids. Genre templates already encode the centre of each style; this exposes the distance from it, which is the parameter that actually produces ideas.
- ★ **Cross-pollination.** Rhythm from one vibe, harmony from another, register and density from a third. The per-channel vibe system is halfway there; what is missing is splitting a vibe into independent *dimensions* that can be mixed.
- ★ **Invert the constraint.** Take the current pattern and generate its opposite: dense where it was sparse, off-beat where it was on, contour mirrored. Not usually the answer, reliably a good question.
- **Wrong-instrument mode.** Play the bassline in the lead's register and timbre, or the melody as a drum part. Trivial to implement given the channel model, and productive far more often than it deserves to be.
- **Constrained chaos.** Genuinely random within hard musical guarantees — any pitch in the scale, any rhythm on the grid, but never outside them. Different in kind from the current template-plus-variation approach, and a good source of things you would not have written.

## 12. Composing for eight mono voices

The original Tracker's limits are the interesting part. A generator that respects them produces material that works on the device; one that ignores them produces material that has to be fixed there.

- ★★ **One sliced drum kit instead of three instruments.** A `.pti` holds **48 slice points**, there is a `Slice` play mode, and the `Slice` FX selects slice 1–48 per step. Rendering kick, snare and hat into a single sliced instrument — triggered by FX rather than by separate instruments — is how people actually build kits on this device. It collapses three instrument slots into one and frees the rest of the sample bank for the parts that need it.
- ★ **Enforce monophony while generating.** Each track is one voice: a note cuts the previous one. Generated harmony that assumes chords will simply not sound as written. The generator should either voice chords across separate tracks deliberately or arpeggiate them — and warn when a part quietly assumes polyphony it will not get.
- ★ **A voice budget.** Eight tracks is the entire arrangement. Treat it as an allocation problem: which parts deserve a track, at which points in the song. Making that budget visible turns "the mix is crowded" into a decision rather than a symptom.
- ★ **Long-form from the playlist.** 255 slots. Generate a piece that evolves for twenty minutes out of a handful of patterns and their variations, with `Break Pattern` for early exits — an album side the device plays by itself, from a project small enough to fit comfortably.
- **Metric modulation via the Tempo FX.** The FX takes 8–400 BPM. Half-time drops, accelerandi and genuine modulations are all reachable per step and none are currently generated.
- **Sample-budget lint.** Before it reaches the SD card: total sample bytes, instrument slots used, and anything that will not fit. *(I have not verified the OG's exact sample memory ceiling, so this should read the true figure from documentation rather than trust a number I assumed.)*
- **Automation slots as a modulation matrix.** Six per instrument, each with an envelope *and* an LFO. Generating a slow filter LFO on a pad, or an envelope on a bass, is one of the biggest sonic returns still unclaimed in the format.

---

## Where I'd start

The original five are built: instrument parameters, the FX table, per-channel seeds, pattern algebra (engine) and full `.mt` import. Those were all *compiler* work — making the export deserve the hardware. With that done, the remaining leverage has moved to the other half of the proposition: making the tool generate things worth arguing with.

Ordered by value per unit of work, for a user who writes their own tracks on an original Tracker:

1. **The fragment bank** (§9). Sixteen one-bar ideas per keypress, starred or discarded in seconds. The generator is already fast enough; only the interface is missing. Nothing else on this list changes the daily loop as much.
2. **Complete the loop** (§10). Lock what you have written, generate only into the gaps, conditioned on the fixed parts. Project import just made this possible, and it is the difference between a generator and a collaborator.
3. **The deviation dial** (§11). One control for distance from the idiom. The styles already encode the centre; exposing the radius is what turns a template engine into a source of ideas.
4. **One sliced drum kit** (§12). Three instrument slots become one, using the 48 slice points and `Slice` FX the format already has — and it matches how kits are actually built on the device.
5. **Export a palette project** (§9). Reuses the multi-pattern exporter to put a shelf of candidate ideas on the hardware, so auditioning happens in the room where the decisions get made.

The through-line has shifted. The beginner document says: hide the machine, hand over a finished track. The first version of this one said: expose the machine completely and get out of the way — which was right, and is now largely done. What is left is the harder half: **stop trying to finish the music.** For this user the tool is at its best when it produces a fragment they did not expect, in a form they can immediately drag into a project they are already writing, on the eight mono voices they actually have.
