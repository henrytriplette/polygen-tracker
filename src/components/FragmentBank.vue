<script setup lang="ts">
import { computed, ref } from 'vue';
import { store, CHANNEL_LABELS } from '../store';
import { FRAGMENT_ROWS } from '../engine';
import type { Fragment } from '../engine';

const state = store.state;
const open = ref(false);

const fragments = computed(() => state.fragments);
const starred = computed(() => fragments.value.filter((f) => f.starred).length);

/**
 * A fragment's contour as a sparkline: one bar per row, height by pitch within
 * the fragment's own range. Reading sixteen candidates as prose is slower than
 * hearing them; a shape is the only thing worth showing at this size.
 */
function bars(fragment: Fragment): { x: number; h: number }[] {
  const notes = fragment.rows.filter((n) => n > 0);
  const low = notes.length ? Math.min(...notes) : 0;
  const high = notes.length ? Math.max(...notes) : 1;
  const span = Math.max(1, high - low);
  return fragment.rows.map((note, i) => ({
    x: i,
    h: note > 0 ? 0.25 + ((note - low) / span) * 0.75 : 0,
  }));
}

function density(fragment: Fragment): number {
  return fragment.rows.filter((n) => n > 0).length;
}
</script>

<template>
  <section class="bank" :class="{ open }">
    <header class="bar">
      <button class="toggle" :title="open ? 'Hide fragment bank' : 'Show fragment bank'" @click="open = !open">
        {{ open ? '▾' : '▸' }} FRAGMENTS
      </button>

      <template v-if="open">
        <select
          class="pick"
          :value="state.fragmentChannel"
          title="Which channel to generate ideas for"
          @change="store.generateFragments(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="(label, ch) in CHANNEL_LABELS" :key="ch" :value="ch">{{ label }}</option>
        </select>

        <button class="act go" title="Generate a batch of one-bar ideas for this channel"
                @click="store.generateFragments(state.fragmentChannel)">
          ⚡ {{ fragments.length ? 'REROLL' : 'GENERATE' }}
        </button>

        <span v-if="fragments.length" class="count">
          {{ fragments.length }} ideas<span v-if="starred"> · {{ starred }} starred</span>
        </span>
        <button
          v-if="fragments.length"
          class="act"
          :disabled="state.isExporting"
          :title="starred
            ? `Export the ${starred} starred ideas as a project to audition on the device`
            : 'Export all candidates as a project to audition on the device'"
          @click="store.exportPalette()"
        >⬇ PALETTE</button>
        <button v-if="fragments.length" class="act" title="Discard all candidates" @click="store.clearFragments()">✕</button>
      </template>
    </header>

    <div v-if="open" class="body">
      <p v-if="!fragments.length" class="empty">
        One bar of {{ CHANNEL_LABELS[state.fragmentChannel] }} per candidate, generated against this pattern's
        chords. Click a shape to hear it, ★ to keep it through a reroll, ↓ to drop it into the pattern.
      </p>

      <ul v-else class="grid">
        <li
          v-for="f in fragments"
          :key="f.id"
          class="frag"
          :class="{ starred: f.starred, playing: state.fragmentPlaying === f.id }"
        >
          <button
            class="shape"
            :title="`Audition — ${f.algo ?? 'default'}, ${density(f)} notes, seed ${f.seed}`"
            @click="store.auditionFragment(f.id)"
          >
            <svg :viewBox="`0 0 ${FRAGMENT_ROWS} 10`" preserveAspectRatio="none">
              <rect
                v-for="b in bars(f)"
                :key="b.x"
                :x="b.x + 0.15"
                :y="10 - b.h * 10"
                width="0.7"
                :height="b.h * 10"
                :fill="store.channelColor(f.channel)"
              />
            </svg>
          </button>
          <div class="row">
            <button class="tiny" :class="{ on: f.starred }" title="Keep through a reroll" @click="store.toggleFragmentStar(f.id)">★</button>
            <button class="tiny" title="Write into the selected pattern" @click="store.applyFragment(f.id)">↓</button>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.bank {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
}

.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 4px 10px;
}

.toggle {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 2px;
  font-weight: 700;
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  padding: 0;
}

.toggle:hover { color: var(--text-dim); }

.pick,
.act {
  font-family: var(--mono);
  font-size: 10px;
  padding: 3px 7px;
  background: var(--field);
  color: var(--text-dim);
  border: 1px solid var(--border);
  cursor: pointer;
}

.pick { box-shadow: var(--shadow-inset); color: var(--text); }
.act:hover { background: var(--field-hover); color: var(--text); }

/* Generation is the action this panel exists for. */
.act.go { color: var(--accent); border-color: var(--accent); }
.act.go:hover { background: var(--accent-soft); }

.count { font-size: 9px; color: var(--text-faint); letter-spacing: 1px; }

.body { padding: 2px 10px 6px; border-top: 1px solid var(--border-subtle); }

.empty {
  font-size: 9px;
  line-height: 1.6;
  color: var(--text-dim);
  max-width: 620px;
  padding: 4px 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
  gap: 4px;
  list-style: none;
  padding-top: 4px;
}

.frag {
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: 3px;
  padding: 2px;
}

.frag.starred { border-color: var(--accent); }
.frag.playing { background: var(--accent-soft); }

.shape {
  display: block;
  width: 100%;
  height: 22px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.shape svg { width: 100%; height: 100%; opacity: 0.85; }
.shape:hover svg { opacity: 1; }

.row { display: flex; gap: 2px; margin-top: 1px; }

.tiny {
  flex: 1;
  font-family: var(--mono);
  font-size: 8px;
  line-height: 1;
  padding: 1px;
  background: var(--field);
  color: var(--text-faint);
  border: 1px solid var(--border-subtle);
  cursor: pointer;
}

.tiny:hover { color: var(--text); background: var(--field-hover); }
.tiny.on { color: var(--accent); border-color: var(--accent); }
</style>
