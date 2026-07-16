<script setup lang="ts">
import { computed } from 'vue';
import { store, CHANNEL_LABELS, VIBE_GROUPS } from '../store';
import { drumNoteToName, effectToDisplayString, zzfxmToNoteName } from '../engine';
import type { VibeName } from '../engine';

const state = store.state;

function onChannelVibe(ch: number, e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  store.setChannelVibe(ch, value === '' ? null : (value as VibeName));
}

const pattern = computed(() => state.song.patterns[state.selectedPattern]);
const effects = computed(() => state.song.patternEffects?.[state.selectedPattern]);

// The playhead only lights up rows when the selected pattern is the one playing.
const liveRow = computed(() => {
  if (!state.isPlaying) return -1;
  const playing = state.song.patternOrder[state.song.sequence[state.playSeqIdx]];
  return playing === state.selectedPattern ? state.playRow : -1;
});

function noteAt(ch: number, row: number): string {
  const note = pattern.value[ch][row + 2];
  if (note <= 0) return '---';
  return ch === 3 ? drumNoteToName(note) : zzfxmToNoteName(note);
}

function fxAt(ch: number, row: number): string {
  return effectToDisplayString(effects.value?.[ch]?.[row]);
}

function hasNote(ch: number, row: number): boolean {
  return pattern.value[ch][row + 2] > 0;
}
</script>

<template>
  <div class="grid-wrap">
    <table class="grid">
      <thead>
        <tr>
          <th class="rownum">##</th>
          <th
            v-for="(label, ch) in CHANNEL_LABELS"
            :key="ch"
            class="ch-head"
            :style="{ color: store.channelColor(ch) }"
            colspan="2"
          >
            <span class="ch-name">{{ ch + 1 }}:{{ label }}</span>
            <span class="ch-btns">
              <button
                class="mini"
                :class="{ active: state.muted[ch] && state.solo === null }"
                title="Mute"
                @click="store.toggleMute(ch)"
              >M</button>
              <button
                class="mini"
                :class="{ active: state.solo === ch }"
                title="Solo"
                @click="store.toggleSolo(ch)"
              >S</button>
              <button class="mini" title="Regenerate channel" @click="store.regenChannel(ch)">↻</button>
            </span>
            <select
              class="ch-vibe"
              :class="{ overridden: !!state.song.channelVibes?.[ch] }"
              :value="state.song.channelVibes?.[ch] ?? ''"
              title="Vibe for this channel (SONG = follow the song vibe)"
              @change="onChannelVibe(ch, $event)"
            >
              <option value="">SONG</option>
              <optgroup v-for="g in VIBE_GROUPS" :key="g.label" :label="g.label">
                <option v-for="v in g.vibes" :key="v.value" :value="v.value">{{ v.label }}</option>
              </optgroup>
            </select>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in 32"
          :key="row"
          :class="{ beat: (row - 1) % 4 === 0, live: liveRow === row - 1 }"
        >
          <td class="rownum">{{ (row - 1).toString(16).toUpperCase().padStart(2, '0') }}</td>
          <template v-for="ch in 4" :key="ch">
            <td
              class="note"
              :style="hasNote(ch - 1, row - 1) ? { color: store.channelColor(ch - 1) } : undefined"
              :class="{ empty: !hasNote(ch - 1, row - 1) }"
            >{{ noteAt(ch - 1, row - 1) }}</td>
            <td class="fx" :class="{ empty: fxAt(ch - 1, row - 1) === '----' }">{{ fxAt(ch - 1, row - 1) }}</td>
          </template>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.grid-wrap {
  overflow: auto;
  border: 1px solid var(--border);
  background: var(--panel);
}

.grid {
  border-collapse: collapse;
  width: 100%;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.5;
}

th {
  position: sticky;
  top: 0;
  background: var(--panel-raised);
  border-bottom: 1px solid var(--border);
  padding: 4px 6px;
  text-align: left;
  font-weight: 600;
  white-space: nowrap;
  z-index: 1;
}

.ch-head { border-left: 1px solid var(--border); }

.ch-name { margin-right: 8px; }

.ch-btns { display: inline-flex; gap: 2px; }

.mini {
  font-family: var(--mono);
  font-size: 10px;
  line-height: 1;
  padding: 2px 5px;
  background: var(--bg);
  color: var(--text-dim);
  border: 1px solid var(--border);
  cursor: pointer;
}

.mini:hover { color: var(--text); border-color: var(--text-dim); }

.mini.active {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
}

.ch-vibe {
  display: block;
  margin-top: 3px;
  font-family: var(--mono);
  font-size: 10px;
  padding: 1px 3px;
  background: var(--bg);
  color: var(--text-dim);
  border: 1px solid var(--border);
  max-width: 110px;
}

.ch-vibe.overridden {
  color: var(--accent);
  border-color: var(--accent);
}

td {
  padding: 0 6px;
  white-space: nowrap;
}

.rownum {
  color: var(--text-dim);
  text-align: right;
  padding: 0 8px;
  border-right: 1px solid var(--border);
}

.note { border-left: 1px solid var(--border); }

.fx { color: var(--fx); }

.empty { color: var(--text-faint); }

tr.beat td { background: var(--row-beat); }

tr.live td {
  background: var(--row-live);
  color: #000 !important;
}

tr.live td.rownum,
tr.live td.empty,
tr.live td.fx { color: rgba(0, 0, 0, 0.55) !important; }
</style>
