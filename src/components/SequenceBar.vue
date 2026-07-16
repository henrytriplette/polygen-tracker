<script setup lang="ts">
import { store } from '../store';
import type { PatternLabel } from '../engine';

const state = store.state;

function labelAt(seqIdx: number): PatternLabel {
  return state.song.patternOrder[state.song.sequence[seqIdx]];
}
</script>

<template>
  <div class="seq">
    <span class="seq-title">SONG</span>
    <div class="seq-chain">
      <button
        v-for="(_, i) in state.song.sequence"
        :key="i"
        class="seq-slot"
        :class="{
          selected: labelAt(i) === state.selectedPattern,
          playing: state.isPlaying && state.playSeqIdx === i,
        }"
        @click="store.selectPattern(labelAt(i))"
      >{{ labelAt(i) }}</button>
    </div>
    <span class="seq-title">PATTERNS</span>
    <div class="seq-chain">
      <button
        v-for="label in state.song.patternOrder"
        :key="label"
        class="seq-slot pattern"
        :class="{ selected: label === state.selectedPattern }"
        :title="`${state.song.patternRoles[label]} — click to view, double-click to regenerate`"
        @click="store.selectPattern(label)"
        @dblclick="store.regenPattern(label)"
      >
        {{ label }}<span class="role">{{ state.song.patternRoles[label].slice(0, 4) }}</span>
      </button>
      <button class="seq-slot regen" title="Regenerate selected pattern" @click="store.regenPattern(state.selectedPattern)">↻ {{ state.selectedPattern }}</button>
    </div>
  </div>
</template>

<style scoped>
.seq {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px 0;
}

.seq-title {
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--text-dim);
}

.seq-chain {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}

.seq-slot {
  font-family: var(--mono);
  font-size: 12px;
  padding: 3px 7px;
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--border);
  cursor: pointer;
}

.seq-slot:hover { border-color: var(--text-dim); }

.seq-slot.selected {
  border-color: var(--accent);
  color: var(--accent);
}

.seq-slot.playing {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
}

.seq-slot .role {
  margin-left: 5px;
  font-size: 10px;
  color: var(--text-dim);
}

.seq-slot.regen { color: var(--fx); }
</style>
