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
      <button
        v-if="state.song.patternOrder.length < 8"
        class="seq-slot add"
        title="Duplicate the selected pattern into a new slot — edit the copy without losing the original"
        @click="store.duplicatePattern()"
      >⧉ DUP</button>
    </div>
  </div>
</template>

<style scoped>
.seq {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 9px 12px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
}

.seq-title {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--text-faint);
  font-weight: 700;
}

.seq-chain {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.seq-slot {
  font-family: var(--mono);
  font-size: 12px;
  padding: 4px 8px;
  background: var(--field);
  color: var(--text);
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  box-shadow: var(--shadow-raise);
}

.seq-slot:hover { background: var(--field-hover); border-color: var(--border-strong); }

/* Current view = selection → orange */
.seq-slot.selected {
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 700;
}

/* Play state → orange fill */
.seq-slot.playing {
  background: var(--accent);
  color: var(--on-accent);
  border-color: var(--accent);
  font-weight: 700;
}

/* Pattern slots are linked/reference data → blue accent on their role tag */
.seq-slot .role {
  margin-left: 5px;
  font-size: 10px;
  color: var(--ref);
}

.seq-slot.regen { color: var(--fx); }
.seq-slot.follow { color: var(--info); }
.seq-slot.follow.selected { color: var(--accent); }

.seq-slot.add { color: var(--text-dim); background: transparent; box-shadow: none; }
.seq-slot.add:hover { color: var(--accent); border-color: var(--accent); background: var(--field); }
</style>
