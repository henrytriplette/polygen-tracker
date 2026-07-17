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
    <button
      class="seq-slot follow"
      :class="{ selected: state.follow }"
      title="Follow the playing pattern in the grid"
      @click="store.toggleFollow()"
    >👁</button>
    <div class="seq-chain">
      <button
        v-for="(_, i) in state.song.sequence"
        :key="i"
        class="seq-slot"
        :class="{
          selected: labelAt(i) === state.selectedPattern,
          playing: state.isPlaying && state.playSeqIdx === i,
        }"
        title="Click: view · Right-click: cycle pattern · Shift+click: remove slot"
        @click="$event.shiftKey ? store.removeSequenceSlot(i) : store.selectPattern(labelAt(i))"
        @contextmenu.prevent="store.cycleSequenceSlot(i)"
      >{{ labelAt(i) }}</button>
      <button
        class="seq-slot add"
        title="Append the selected pattern to the song chain"
        @click="store.appendSequenceSlot()"
      >+</button>
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
      <button
        v-if="state.song.patternOrder.length < 8"
        class="seq-slot add"
        title="Add a new generated pattern (also appended to the song chain)"
        @click="store.addPattern()"
      >+PAT</button>
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

.seq-slot.add { color: var(--text-dim); }
.seq-slot.add:hover { color: var(--accent); border-color: var(--accent); }
</style>
