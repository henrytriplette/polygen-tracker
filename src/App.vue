<script setup lang="ts">
import { store, VIBE_GROUPS } from './store';
import { CHROMATIC, STRUCTURE_OPTIONS } from './engine';
import type { NoteName, ScaleName, SongLength, VibeName } from './engine';
import ChordBar from './components/ChordBar.vue';
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
</script>

<template>
  <div class="app">
    <header class="bar">
      <h1 class="brand">POLYGEN<span>::TRACKER</span></h1>
      <input class="name-input" :value="state.song.config.name" spellcheck="false" @change="onName" />
      <div class="spacer" />
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
      <div class="spacer" />
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
