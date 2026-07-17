<script setup lang="ts">
import { computed, ref } from 'vue';
import { store, CHANNEL_LABELS, CHANNEL_ALGO_OPTIONS, VIBE_GROUPS } from '../store';
import { DRUM_NOTES, drumNoteToName, effectToDisplayString, noteToZzfxm, zzfxmToNoteName } from '../engine';
import type { VibeName } from '../engine';

const state = store.state;

function onChannelVibe(ch: number, e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  store.setChannelVibe(ch, value === '' ? null : (value as VibeName));
}

function onChannelAlgo(ch: number, e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  store.setChannelAlgo(ch, value === '' ? null : value);
}

// --- Note editing ---------------------------------------------------------
// Click a note cell to place the cursor, then type notes tracker-style.
const cursor = ref<{ ch: number; row: number } | null>(null);
const octave = ref(4);
const gridEl = ref<HTMLElement | null>(null);

// FastTracker-style piano layout: bottom row = current octave, top row = +1.
const PIANO_KEYS: Record<string, number> = {
  z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11,
  q: 12, '2': 13, w: 14, '3': 15, e: 16, r: 17, '5': 18, t: 19, '6': 20, y: 21, '7': 22, u: 23,
};

const DRUM_KEYS: Record<string, number> = {
  '1': DRUM_NOTES.KICK,
  '2': DRUM_NOTES.SNARE,
  '3': DRUM_NOTES.HAT,
};

function selectCell(ch: number, row: number) {
  cursor.value = { ch, row };
  gridEl.value?.focus();
}

function moveCursor(dCh: number, dRow: number) {
  if (!cursor.value) return;
  cursor.value = {
    ch: (cursor.value.ch + dCh + 4) % 4,
    row: (cursor.value.row + dRow + 32) % 32,
  };
}

function enterNote(note: number) {
  if (!cursor.value) return;
  const clamped = Math.max(0, Math.min(48, note));
  const snapped = store.snapNote(cursor.value.ch, clamped);
  store.setNote(cursor.value.ch, cursor.value.row, snapped);
  store.previewNote(cursor.value.ch, snapped);
  moveCursor(0, 1); // tracker convention: advance to the next row
}

function onKey(e: KeyboardEvent) {
  if (!cursor.value) return;
  const key = e.key.toLowerCase();

  switch (e.key) {
    case 'ArrowUp': moveCursor(0, -1); e.preventDefault(); return;
    case 'ArrowDown': moveCursor(0, 1); e.preventDefault(); return;
    case 'ArrowLeft': moveCursor(-1, 0); e.preventDefault(); return;
    case 'ArrowRight': moveCursor(1, 0); e.preventDefault(); return;
    case 'Escape': cursor.value = null; return;
    case 'Delete':
    case 'Backspace':
      store.setNote(cursor.value.ch, cursor.value.row, 0);
      moveCursor(0, 1);
      e.preventDefault();
      return;
  }

  if (key === '+' || key === '=') { octave.value = Math.min(6, octave.value + 1); e.preventDefault(); return; }
  if (key === '-') { octave.value = Math.max(3, octave.value - 1); e.preventDefault(); return; }
  if (key === '.') { store.setNote(cursor.value.ch, cursor.value.row, 0); moveCursor(0, 1); e.preventDefault(); return; }

  // Drums: 1/2/3 = kick/snare/hat (takes priority over the piano's sharp digits)
  if (cursor.value.ch === 3 && key in DRUM_KEYS) {
    enterNote(DRUM_KEYS[key]);
    e.preventDefault();
    return;
  }

  if (key in PIANO_KEYS && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const offset = PIANO_KEYS[key];
    const note = noteToZzfxm(offset % 12, octave.value + Math.floor(offset / 12));
    if (note >= 1 && note <= 48) enterNote(note);
    e.preventDefault();
  }
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
  <div ref="gridEl" class="grid-wrap" tabindex="0" @keydown="onKey">
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
            <select
              class="ch-vibe algo"
              :class="{ overridden: !!state.song.channelAlgos?.[ch] }"
              :value="state.song.channelAlgos?.[ch] ?? ''"
              title="Pattern algorithm for this channel (AUTO = vibe default)"
              @change="onChannelAlgo(ch, $event)"
            >
              <option value="">AUTO</option>
              <option v-for="a in CHANNEL_ALGO_OPTIONS[ch]" :key="a.value" :value="a.value">{{ a.label }}</option>
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
              :class="{
                empty: !hasNote(ch - 1, row - 1),
                cursor: cursor?.ch === ch - 1 && cursor?.row === row - 1,
              }"
              @click="selectCell(ch - 1, row - 1)"
            >{{ noteAt(ch - 1, row - 1) }}</td>
            <td class="fx" :class="{ empty: fxAt(ch - 1, row - 1) === '----' }">{{ fxAt(ch - 1, row - 1) }}</td>
          </template>
        </tr>
      </tbody>
    </table>
    <div class="edit-bar">
      <span v-if="cursor" class="edit-active">
        EDIT {{ CHANNEL_LABELS[cursor.ch] }} {{ cursor.row.toString(16).toUpperCase().padStart(2, '0') }}
        · OCT {{ octave }}
      </span>
      <span v-else class="edit-idle">CLICK A NOTE CELL TO EDIT</span>
      <button
        class="snap-btn"
        :class="{ active: state.snapToScale }"
        :title="`Snap entered notes to ${state.song.config.key} ${state.song.config.scale}`"
        @click="store.toggleSnap()"
      >SNAP:{{ state.snapToScale ? 'ON' : 'OFF' }}</button>
      <span class="edit-help">
        Z-M / Q-U notes · 1/2/3 drums · DEL clear · +/- octave · arrows move · ESC done
      </span>
    </div>
  </div>
</template>

<style scoped>
.grid-wrap {
  overflow: auto;
  border: 1px solid var(--border);
  background: var(--panel);
  outline: none;
  display: flex;
  flex-direction: column;
}

.grid-wrap:focus-within,
.grid-wrap:focus {
  border-color: var(--text-dim);
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

.ch-vibe.algo { margin-top: 2px; color: var(--fx); }

.ch-vibe.algo.overridden {
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

.note {
  border-left: 1px solid var(--border);
  cursor: pointer;
}

.note:hover { background: rgba(255, 138, 42, 0.12); }

.note.cursor {
  outline: 1px solid var(--accent);
  outline-offset: -1px;
  background: rgba(255, 138, 42, 0.18);
}

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

.edit-bar {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 4px 8px;
  border-top: 1px solid var(--border);
  background: var(--panel-raised);
  font-size: 10px;
  letter-spacing: 0.5px;
  position: sticky;
  bottom: 0;
  margin-top: auto;
}

.edit-active { color: var(--accent); white-space: nowrap; }

.snap-btn {
  font-family: var(--mono);
  font-size: 10px;
  padding: 1px 6px;
  background: var(--bg);
  color: var(--text-dim);
  border: 1px solid var(--border);
  cursor: pointer;
}

.snap-btn.active {
  color: var(--accent);
  border-color: var(--accent);
}

.edit-idle { color: var(--text-dim); white-space: nowrap; }

.edit-help { color: var(--text-faint); }
</style>
