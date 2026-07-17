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
  gap: 10px;
  flex-wrap: wrap;
  padding: 7px 10px;
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
  flex-direction: column;
  gap: 2px;
}

.bars {
  font-size: 9px;
  color: var(--text-faint);
  text-align: center;
}

.chord-slot select {
  font-family: var(--mono);
  font-size: 12px;
  background: var(--field);
  color: var(--fx);
  border: 1px solid var(--border);
  padding: 4px 6px;
  box-shadow: var(--shadow-inset);
  cursor: pointer;
}

.chord-slot select:hover { background: var(--field-hover); border-color: var(--fx); }

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
