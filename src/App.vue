<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { store, VIBE_GROUPS } from './store';
import { CHROMATIC, STRUCTURE_OPTIONS } from './engine';
import type { NoteName, ScaleName, SongLength, VibeName } from './engine';
import ChordBar from './components/ChordBar.vue';
import Oscilloscope from './components/Oscilloscope.vue';
import SequenceBar from './components/SequenceBar.vue';
import TrackerGrid from './components/TrackerGrid.vue';

const state = store.state;

function onVibe(e: Event) {
  store.setVibe((e.target as HTMLSelectElement).value as VibeName);
}
function onStructure(e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  store.setStructure(value === '' ? null : value);
}

const SCALES: ScaleName[] = ['major', 'minor', 'pentatonic', 'dorian', 'mixolydian', 'harmonicMinor'];
const LENGTHS: SongLength[] = ['short', 'long', 'epic'];

function onKey(e: Event) {
  store.setKey((e.target as HTMLSelectElement).value as NoteName);
}
function onScale(e: Event) {
  store.setScale((e.target as HTMLSelectElement).value as ScaleName);
}
function onLength(e: Event) {
  store.setLength((e.target as HTMLSelectElement).value as SongLength);
}
function onBpm(e: Event) {
  store.setBpm(Number((e.target as HTMLInputElement).value));
}
function onName(e: Event) {
  store.setName((e.target as HTMLInputElement).value);
}
function onSeed(e: Event) {
  state.seedInput = (e.target as HTMLInputElement).value;
}
function onLoadProject(e: Event) {
  const select = e.target as HTMLSelectElement;
  if (select.value) store.loadProject(select.value);
  select.value = '';
}
async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    try {
      await store.importSongJson(file);
    } catch (err) {
      console.error('Import failed:', err);
    }
  }
  input.value = '';
}

// Global transport / history shortcuts. Typing fields keep their native keys.
function onGlobalKey(e: KeyboardEvent) {
  const target = e.target as HTMLElement;
  const typing = target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA';

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    if (e.shiftKey) store.redo();
    else store.undo();
    e.preventDefault();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    store.redo();
    e.preventDefault();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
    store.newSong();
    e.preventDefault();
    return;
  }
  if (e.key === ' ' && !typing) {
    store.togglePlay();
    e.preventDefault();
  }
}

async function onImportMtp(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    try {
      await store.importMtp(file);
    } catch (err) {
      console.error('MTP import failed:', err);
    }
  }
  input.value = '';
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKey);
  store.loadFromHash();
});
onUnmounted(() => window.removeEventListener('keydown', onGlobalKey));
</script>

<template>
  <div class="app">
    <header class="bar">
      <h1 class="brand">POLYGEN<span>::TRACKER</span></h1>
      <input class="name-input" :value="state.song.config.name" spellcheck="false" @change="onName" />
      <Oscilloscope />
      <div class="spacer" />
      <button class="btn" :disabled="!state.undoCount" title="Undo (Ctrl+Z)" @click="store.undo()">↶</button>
      <button class="btn" :disabled="!state.redoCount" title="Redo (Ctrl+Y)" @click="store.redo()">↷</button>
      <button class="btn" title="Small variation of the selected pattern" @click="store.mutate()">🧬 MUTATE</button>
      <button class="btn primary" @click="store.newSong()">⟳ GENERATE</button>
      <button class="btn play" :class="{ active: state.isPlaying }" @click="store.togglePlay()">
        {{ state.isPlaying ? '■ STOP' : '▶ PLAY' }}
      </button>
    </header>

    <section class="bar controls">
      <div class="ctl-group">
        <span class="group-label">COMPOSITION</span>
        <div class="group-fields">
          <label class="ctl">
            <span>VIBE</span>
            <select class="vibe-select" :value="state.song.config.vibe" @change="onVibe">
              <optgroup v-for="g in VIBE_GROUPS" :key="g.label" :label="g.label">
                <option v-for="v in g.vibes" :key="v.value" :value="v.value">{{ v.label }}</option>
              </optgroup>
            </select>
          </label>

          <label class="ctl">
            <span>KEY</span>
            <select :value="state.song.config.key" @change="onKey">
              <option v-for="n in CHROMATIC" :key="n" :value="n">{{ n }}</option>
            </select>
          </label>

          <label class="ctl">
            <span>SCALE</span>
            <select :value="state.song.config.scale" @change="onScale">
              <option v-for="s in SCALES" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>
        </div>
      </div>

      <div class="ctl-group">
        <span class="group-label">GENERATION</span>
        <div class="group-fields">
          <label class="ctl">
            <span>LENGTH</span>
            <select :value="state.song.config.length" @change="onLength">
              <option v-for="l in LENGTHS" :key="l" :value="l">{{ l }}</option>
            </select>
          </label>

          <label class="ctl">
            <span>STRUCT</span>
            <select :value="state.song.structureId ?? ''" @change="onStructure">
              <option value="">AUTO (vibe)</option>
              <option v-for="s in STRUCTURE_OPTIONS" :key="s.id" :value="s.id" :title="s.description">
                {{ s.label }}
              </option>
            </select>
          </label>

          <label class="ctl">
            <span>SEED</span>
            <input
              class="seed"
              :value="state.seedInput"
              :placeholder="state.lastSeed !== null ? String(state.lastSeed) : 'random'"
              title="Enter a seed for reproducible generation; empty = random (last used shown)"
              spellcheck="false"
              @change="onSeed"
            />
          </label>
        </div>
      </div>

      <div class="ctl-group">
        <span class="group-label">TIMING</span>
        <div class="group-fields">
          <label class="ctl">
            <span>BPM</span>
            <input class="bpm" type="number" min="40" max="220" :value="state.song.config.bpm" @change="onBpm" />
            <button class="btn mini" title="Random BPM for this vibe" @click="store.rollBpm()">🎲</button>
          </label>

          <label class="ctl">
            <span>SWING</span>
            <input
              class="bpm"
              type="number"
              min="0"
              max="30"
              :value="state.song.config.swing ?? 0"
              title="Swing % — odd 16ths play late (exports as Micro-move FX)"
              @change="store.setSwing(Number(($event.target as HTMLInputElement).value))"
            />
          </label>

          <label class="ctl">
            <span>HUMANIZE</span>
            <input
              class="bpm"
              type="number"
              min="0"
              max="30"
              :value="state.song.config.humanize ?? 0"
              title="Humanize % — random per-note velocity (exports as Volume FX)"
              @change="store.setHumanize(Number(($event.target as HTMLInputElement).value))"
            />
          </label>
        </div>
      </div>
    </section>

    <SequenceBar />
    <ChordBar />

    <main class="main">
      <TrackerGrid />
    </main>

    <footer class="bar export">
      <span class="export-title">EXPORT</span>
      <label class="ctl">
        <span>DEVICE</span>
        <select v-model.number="state.exportDevice">
          <option :value="12">Tracker fw 1.9+ (12 trk)</option>
          <option :value="8">Tracker fw ≤1.8 (8 trk)</option>
          <option :value="16">Tracker+ / Mini (16 trk)</option>
        </select>
      </label>
      <button class="btn primary" :disabled="state.isExporting" @click="store.exportPolyend()">
        {{ state.isExporting ? 'PACKING…' : '⬇ POLYEND PROJECT (.zip)' }}
      </button>
      <button class="btn" :disabled="state.isExporting" title="Only pattern_XX.mtp files — drop into an existing project's patterns folder" @click="store.exportPatterns()">⬇ PATTERNS (.mtp)</button>
      <button class="btn" @click="store.exportWav()">⬇ WAV</button>
      <button class="btn" :disabled="state.isExporting" title="Zip of 4 per-channel WAV stems" @click="store.exportStems()">⬇ STEMS</button>
      <button class="btn" title="Standard MIDI file (4 tracks, GM drums)" @click="store.exportMidi()">⬇ MIDI</button>
      <button class="btn" title="Song as JSON (.polygen.json)" @click="store.exportSongJson()">⬇ JSON</button>
      <label class="btn file-btn" title="Load a .polygen.json song file">
        ⬆ IMPORT<input type="file" accept=".json,application/json" @change="onImportFile" />
      </label>
      <label class="btn file-btn" title="Import a Polyend .mtp pattern into the selected pattern (best effort)">
        ⬆ .MTP<input type="file" accept=".mtp" @change="onImportMtp" />
      </label>
      <button class="btn" title="Copy a shareable URL with the whole song in it" @click="store.shareUrl()">
        {{ state.shareStatus === 'copied' ? '✓ COPIED' : state.shareStatus === 'failed' ? '✗ FAILED' : '🔗 SHARE' }}
      </button>
      <div class="spacer" />
      <span class="ctl">
        <span>PROJECTS</span>
        <button class="btn mini" title="Save current song to the browser" @click="store.saveProject()">💾 SAVE</button>
        <select v-if="state.projects.length" title="Load a saved project" @change="onLoadProject">
          <option value="">LOAD…</option>
          <option v-for="p in state.projects" :key="p.id" :value="p.id">
            {{ p.name }} ({{ new Date(p.savedAt).toLocaleDateString() }})
          </option>
        </select>
      </span>
      <span class="hint">unzip into /Projects on the Tracker's SD card</span>
    </footer>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 10px 14px 8px;
  gap: 8px;
}

.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* --- Header: highest emphasis layer -------------------------------------- */
header.bar {
  background: var(--panel-raised);
  border-radius: 4px;
  padding: 7px 10px;
  box-shadow: var(--shadow-raise);
}

.brand {
  font-family: var(--mono);
  font-size: 18px;
  font-weight: 700;
  color: var(--accent);
  margin: 0;
  letter-spacing: 1px;
}

.brand span { color: var(--text-dim); font-weight: 400; }

.name-input {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 600;
  background: var(--field);
  color: var(--text-bright);
  border: 1px solid var(--border);
  padding: 5px 9px;
  min-width: 220px;
  box-shadow: var(--shadow-inset);
}

.name-input:hover { background: var(--field-hover); }
.name-input:focus { border-color: var(--accent); outline: none; }

.spacer { flex: 1; }

/* --- Control groups: composition / generation / timing ------------------- */
.controls {
  padding: 2px 0;
  gap: 22px;
  align-items: stretch;
}

.ctl-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  position: relative;
}

.ctl-group + .ctl-group::before {
  content: '';
  position: absolute;
  left: -11px;
  top: 2px;
  bottom: 2px;
  width: 1px;
  background: var(--border-subtle);
}

.group-label {
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--text-faint);
  font-weight: 700;
  padding-left: 1px;
}

.group-fields {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.ctl {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--text-dim);
}

/* --- Interactive fields read as clickable, not as labels ----------------- */
.vibe-select {
  min-width: 130px;
  border-color: var(--border-strong);
  color: var(--text-bright);
  font-weight: 600;
}

select,
.bpm {
  font-family: var(--mono);
  font-size: 12px;
  background: var(--field);
  color: var(--text);
  border: 1px solid var(--border);
  padding: 5px 7px;
  box-shadow: var(--shadow-inset);
  cursor: pointer;
}

select:hover,
.bpm:hover { background: var(--field-hover); border-color: var(--border-strong); }
select:focus,
.bpm:focus { border-color: var(--accent); outline: none; }

.bpm { width: 58px; cursor: text; }

.seed {
  font-family: var(--mono);
  font-size: 12px;
  background: var(--field);
  color: var(--text);
  border: 1px solid var(--border);
  padding: 5px 7px;
  width: 105px;
  box-shadow: var(--shadow-inset);
}

.seed:hover { background: var(--field-hover); }
.seed:focus { border-color: var(--accent); outline: none; }

.file-btn {
  position: relative;
  overflow: hidden;
  display: inline-block;
}

.file-btn input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

/* --- Buttons: layered affordances ---------------------------------------- */
.btn {
  font-family: var(--mono);
  font-size: 12px;
  padding: 6px 11px;
  background: var(--field);
  color: var(--text);
  border: 1px solid var(--border);
  cursor: pointer;
  white-space: nowrap;
  box-shadow: var(--shadow-raise);
}

.btn:hover { background: var(--field-hover); border-color: var(--border-strong); }
.btn:active { box-shadow: var(--shadow-inset); }
.btn:disabled { opacity: 0.4; cursor: default; box-shadow: none; }

/* GENERATE — a primary action, gets the orange */
.btn.primary {
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}

.btn.primary:hover { background: var(--accent); color: #000; }

/* PLAY — the most alive control on screen */
.btn.play {
  border-color: var(--ch-lead);
  color: var(--ch-lead);
  font-weight: 700;
  min-width: 92px;
  padding: 6px 14px;
  letter-spacing: 1px;
  background: linear-gradient(180deg, rgba(93, 217, 124, 0.12), rgba(93, 217, 124, 0.04));
}

.btn.play:hover { background: var(--ch-lead); color: #000; }

.btn.play.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #000;
  box-shadow: 0 0 0 1px var(--accent), 0 0 14px rgba(255, 138, 42, 0.5);
  animation: play-pulse 1.4s ease-in-out infinite;
}

@keyframes play-pulse {
  0%, 100% { box-shadow: 0 0 0 1px var(--accent), 0 0 10px rgba(255, 138, 42, 0.35); }
  50% { box-shadow: 0 0 0 1px var(--accent), 0 0 18px rgba(255, 138, 42, 0.6); }
}

.btn.mini { padding: 4px 7px; font-size: 11px; box-shadow: none; }

.main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.main > * { flex: 1; min-height: 0; }

/* --- Export: lowest emphasis — recedes behind the tracker ---------------- */
.export {
  padding: 6px 2px 0;
  margin-top: 2px;
  border-top: 1px solid var(--border-subtle);
  gap: 5px;
  font-size: 11px;
}

.export .btn {
  padding: 4px 8px;
  font-size: 11px;
  background: transparent;
  border-color: var(--border-subtle);
  color: var(--text-dim);
  box-shadow: none;
}

.export .btn:hover { background: var(--field); color: var(--text); border-color: var(--border); }

.export .btn.primary {
  background: transparent;
  border-color: var(--border);
  color: var(--text);
}

.export .btn.primary:hover { background: var(--accent); border-color: var(--accent); color: #000; }

.export select { font-size: 11px; padding: 4px 6px; }

.export-title {
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--text-faint);
  font-weight: 700;
}

.hint {
  font-size: 10px;
  color: var(--text-faint);
  font-family: var(--mono);
}
</style>
