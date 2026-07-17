<script setup lang="ts">
import { computed } from 'vue';
import { store } from '../store';
import { CHORDS_PER_PATTERN, chordDisplayName } from '../engine';

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

function onChord(slot: number, e: Event) {
  store.setChordDegree(slot, Number((e.target as HTMLSelectElement).value));
}
</script>

<template>
  <div class="chords">
    <span class="chords-title">CHORDS {{ state.selectedPattern }}</span>
    <div class="chord-slots">
      <label v-for="(deg, slot) in degrees" :key="slot" class="chord-slot">
        <span class="bars">{{ slot * 8 }}-{{ slot * 8 + 7 }}</span>
        <select :value="deg" @change="onChord(slot, $event)">
          <option v-for="(r, d) in ROMAN" :key="d" :value="d">
            {{ r }} · {{ nameFor(d) }}
          </option>
        </select>
      </label>
    </div>
    <button class="dice" title="Random progression (harmony vibe)" @click="store.rollChords()">🎲 ROLL</button>
    <span class="chords-hint">harmony + bass follow the chords · lead is untouched</span>
  </div>
</template>

<style scoped>
.chords {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 2px 0 6px;
}

.chords-title {
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--text-dim);
}

.chord-slots {
  display: flex;
  gap: 2px;
}

.chord-slot {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.bars {
  font-size: 9px;
  color: var(--text-faint);
  text-align: center;
}

.chord-slot select {
  font-family: var(--mono);
  font-size: 12px;
  background: var(--panel);
  color: var(--fx);
  border: 1px solid var(--border);
  padding: 3px 5px;
}

.chord-slot select:hover { border-color: var(--text-dim); }

.dice {
  font-family: var(--mono);
  font-size: 11px;
  padding: 4px 8px;
  background: var(--panel);
  color: var(--fx);
  border: 1px solid var(--border);
  cursor: pointer;
  align-self: flex-end;
}

.dice:hover { border-color: var(--fx); }

.chords-hint {
  font-size: 10px;
  color: var(--text-faint);
  align-self: flex-end;
}
</style>
