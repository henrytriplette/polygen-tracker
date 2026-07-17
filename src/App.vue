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

      <label class="ctl">
        <span>LEN</span>
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
        <span>HUM</span>
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
  padding: 8px 12px;
  gap: 4px;
}

.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--border);
  padding: 5px 8px;
  min-width: 220px;
}

.name-input:focus { border-color: var(--accent); outline: none; }

.spacer { flex: 1; }

.controls { padding: 2px 0; }

.ctl {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--text-dim);
}

.vibe-select {
  min-width: 130px;
  border-color: var(--accent);
  color: var(--accent);
}

select,
.bpm {
  font-family: var(--mono);
  font-size: 12px;
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--border);
  padding: 4px 6px;
}

.bpm { width: 60px; }

.seed {
  font-family: var(--mono);
  font-size: 12px;
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--border);
  padding: 4px 6px;
  width: 105px;
}

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

.btn {
  font-family: var(--mono);
  font-size: 12px;
  padding: 5px 10px;
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--border);
  cursor: pointer;
  white-space: nowrap;
}

.btn:hover { border-color: var(--text-dim); }
.btn:disabled { opacity: 0.5; cursor: default; }

.btn.primary {
  border-color: var(--accent);
  color: var(--accent);
}

.btn.primary:hover { background: var(--accent); color: #000; }

.btn.play {
  border-color: var(--ch-lead);
  color: var(--ch-lead);
  min-width: 80px;
}

.btn.play.active,
.btn.play:hover { background: var(--ch-lead); color: #000; }

.btn.mini { padding: 3px 6px; font-size: 11px; }

.main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.main > * { flex: 1; min-height: 0; }

.export { padding-top: 6px; border-top: 1px solid var(--border); }

.export-title {
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--text-dim);
}

.hint {
  font-size: 11px;
  color: var(--text-faint);
  font-family: var(--mono);
}
</style>
