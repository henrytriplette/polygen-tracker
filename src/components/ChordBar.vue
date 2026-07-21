<script setup lang="ts">
import { computed } from 'vue';
import { store } from '../store';
import { CHORDS_PER_PATTERN, chordDisplayName, rowsPerChord } from '../engine';
import type { ChordMode } from '../engine';

const state = store.state;

// Roman numerals for the 7 scale degrees (quality shown via chord name)
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const degrees = computed(() => {
  const stored = state.song.patternChords?.[state.selectedPattern];
  return stored ?? Array(CHORDS_PER_PATTERN).fill(0);
});

function nameFor(degree: number): string {
  return chordDisplayName(degree, state.song.config.key, state.song.config.scale);
}

/**
 * Rows this chord covers. Derived from the pattern length rather than assumed:
 * the progression always divides the pattern into four, so a 64-row pattern
 * gives each chord 16 rows, not the 8 a 32-row pattern does.
 */
function rowRange(slot: number): string {
  const per = rowsPerChord(state.song.config.patternLength ?? 32);
  return `${slot * per}-${slot * per + per - 1}`;
}

function onChord(slot: number, e: Event) {
  store.setChordDegree(slot, Number((e.target as HTMLSelectElement).value));
}

function onMode(e: Event) {
  store.setChordMode((e.target as HTMLSelectElement).value as ChordMode);
}
</script>

<template>
  <div class="chords">
    <span class="chords-title">CHORDS {{ state.selectedPattern }}</span>
    <div class="chord-slots">
      <label v-for="(deg, slot) in degrees" :key="slot" class="chord-slot">
        <select :value="deg" :title="`Rows ${rowRange(slot)}`" @change="onChord(slot, $event)">
          <option v-for="(r, d) in ROMAN" :key="d" :value="d">
            {{ r }} · {{ nameFor(d) }}
          </option>
        </select>
      </label>
    </div>
    <select
      class="mode"
      :value="state.song.chordMode ?? 'pool'"
      title="POOL = curated progressions for the vibe · MARKOV = walk the vibe's harmonic chain"
      @change="onMode"
    >
      <option value="pool">POOL</option>
      <option value="markov">MARKOV</option>
    </select>
    <button class="dice" title="New progression (harmony vibe)" @click="store.rollChords()">🎲 ROLL</button>
    <span class="chords-hint">harmony + bass follow the chords · lead is untouched</span>
  </div>
</template>

<style scoped>
.chords {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 4px 10px;
  background: var(--panel);
  border-radius: 4px;
  box-shadow: var(--shadow-raise);
}

.chords-title {
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--text-faint);
  font-weight: 700;
}

.chord-slots {
  display: flex;
  gap: 4px;
}

.chord-slot {
  display: flex;
}

.chord-slot select {
  font-family: var(--mono);
  font-size: 12px;
  background: var(--field);
  color: var(--fx);
  border: 1px solid var(--border);
  padding: 2px 6px;
  box-shadow: var(--shadow-inset);
  cursor: pointer;
}

.chord-slot select:hover { background: var(--field-hover); border-color: var(--fx); }

.mode {
  font-family: var(--mono);
  font-size: 10px;
  padding: 2px 6px;
  background: var(--field);
  color: var(--fx);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-inset);
  cursor: pointer;
}

.mode:hover { background: var(--field-hover); border-color: var(--fx); }

.dice {
  font-family: var(--mono);
  font-size: 11px;
  padding: 5px 9px;
  background: var(--field);
  color: var(--fx);
  border: 1px solid var(--border);
  cursor: pointer;
  align-self: flex-end;
  box-shadow: var(--shadow-raise);
}

.dice:hover { background: var(--field-hover); border-color: var(--fx); }

.chords-hint {
  font-size: 10px;
  color: var(--text-faint);
  align-self: flex-end;
}
</style>
