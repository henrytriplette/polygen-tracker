<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { store, CHANNEL_LABELS, CHANNEL_SOUND_OPTIONS } from '../store';
import {
  PARAM_GROUPS,
  envelopePoints,
  formatBytes,
  isDrumChannel,
  paramsInGroup,
  sampleReport,
} from '../engine';
import type { ParamDef } from '../engine';

const state = store.state;

const open = ref(false);
const channel = ref(0);

// The per-group explanations are worth having but cost a block of vertical
// space on every group. Off by default, one click away — the panel stays
// compact for someone who knows the parameters and stays teachable for
// someone who doesn't.
const hints = ref(false);

const params = computed(() => state.song.instruments[channel.value] ?? []);
const locked = computed(() => state.song.lockedInstruments?.[channel.value] ?? false);

function valueOf(def: ParamDef): number {
  return params.value[def.index] ?? 0;
}

function onParam(def: ParamDef, e: Event) {
  store.setInstrumentParam(channel.value, def.index, Number((e.target as HTMLInputElement).value));
}

function onSound(e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  store.setChannelSound(channel.value, value === '' ? null : value);
}

// --- ADSR curve -------------------------------------------------------------
const envPath = computed(() => {
  const { points, duration } = envelopePoints(params.value);
  const w = 200;
  const h = 46;
  const pad = 3;
  return points
    .map((p, i) => {
      const x = pad + (p.t / duration) * (w - pad * 2);
      const y = h - pad - p.v * (h - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
});

const envDuration = computed(() => envelopePoints(params.value).duration);

// --- Exported sample size ---------------------------------------------------
// This renders the instrument for real, the same way the .pti exporter does,
// which costs up to ~25ms for the longest sounds the sliders can reach. That
// is past a frame at the rate a drag fires input events, so it settles after
// the drag rather than tracking it — the number is feedback, not a readout
// anyone follows mid-gesture.
const SAMPLE_DEBOUNCE_MS = 150;

const sample = ref(sampleReport(params.value, isDrumChannel(channel.value)));
let sampleTimer: ReturnType<typeof setTimeout> | undefined;

watch(
  [params, channel],
  ([next, ch]) => {
    clearTimeout(sampleTimer);
    sampleTimer = setTimeout(() => {
      sample.value = sampleReport(next, isDrumChannel(ch));
    }, SAMPLE_DEBOUNCE_MS);
  },
  { immediate: true }
);

onBeforeUnmount(() => clearTimeout(sampleTimer));

// Follow the grid's edit cursor so the panel shows the channel you're on
watch(
  () => state.instrumentChannel,
  (ch) => {
    if (typeof ch === 'number') channel.value = ch;
  }
);
</script>

<template>
  <section class="inst" :class="{ open }">
    <header class="inst-bar">
      <button class="toggle" :title="open ? 'Hide instrument editor' : 'Show instrument editor'" @click="open = !open">
        {{ open ? '▾' : '▸' }} INSTRUMENT
      </button>

      <div v-if="open" class="tabs">
        <button
          v-for="(label, ch) in CHANNEL_LABELS"
          :key="ch"
          class="tab"
          :class="{ active: channel === ch }"
          :style="channel === ch ? { color: store.channelColor(ch), borderColor: store.channelColor(ch) } : undefined"
          @click="channel = ch"
        >
          {{ label }}<span v-if="state.song.lockedInstruments?.[ch]" class="pin">·</span>
        </button>
      </div>

      <div v-if="open" class="actions">
        <button
          class="act"
          :class="{ on: hints }"
          :title="hints ? 'Hide the parameter explanations' : 'Explain what each group does to the sound'"
          @click="hints = !hints"
        >?</button>
        <select class="sound" :value="state.song.channelSounds?.[channel] ?? ''" title="Base timbre" @change="onSound">
          <option value="">AUTO</option>
          <option v-for="s in CHANNEL_SOUND_OPTIONS[channel]" :key="s.value" :value="s.value">{{ s.label }}</option>
        </select>
        <button class="act" title="Audition this instrument" @click="store.previewInstrument(channel)">▶</button>
        <button class="act" title="New random timbre for this channel" @click="store.rerollInstrument(channel)">🎲</button>
        <button
          class="act"
          :class="{ on: locked }"
          title="Lock: keep this sound when the song is regenerated"
          @click="store.toggleInstrumentLock(channel)"
        >{{ locked ? '🔒' : '🔓' }}</button>
      </div>
    </header>

    <div v-if="open" class="body">
      <div class="env">
        <svg viewBox="0 0 200 46" preserveAspectRatio="none" class="env-svg">
          <path :d="envPath" fill="none" :stroke="store.channelColor(channel)" stroke-width="1.5" />
        </svg>
        <span class="env-label">ENVELOPE · {{ Math.round(envDuration * 1000) }}ms</span>

        <div class="sample" :class="sample.warning ? 'warn' : ''">
          <span class="s-size">
            SAMPLE · {{ sample.seconds < 1 ? Math.round(sample.seconds * 1000) + 'ms' : sample.seconds.toFixed(2) + 's' }}
            · {{ formatBytes(sample.bytes) }}
          </span>
          <p v-if="sample.message" class="s-msg">⚠ {{ sample.message }}</p>
        </div>
      </div>

      <div v-for="group in PARAM_GROUPS" :key="group.id" class="group">
        <span class="group-title" :title="group.description">{{ group.label }}</span>
        <p v-if="hints" class="group-desc">{{ group.description }}</p>
        <label v-for="def in paramsInGroup(group.id)" :key="def.index" class="param" :title="def.hint">
          <span class="p-label">{{ def.label }}</span>
          <input
            type="range"
            :min="def.min"
            :max="def.max"
            :step="def.step"
            :value="valueOf(def)"
            @input="onParam(def, $event)"
          />
          <span class="p-value">{{ def.format(valueOf(def)) }}</span>
        </label>
      </div>
    </div>
  </section>
</template>

<style scoped>
.inst {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
}

.inst-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 4px 10px;
}

.toggle {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 2px;
  font-weight: 700;
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  padding: 0;
}

.toggle:hover { color: var(--text-dim); }

.tabs { display: flex; gap: 2px; }

.tab {
  font-family: var(--mono);
  font-size: 10px;
  padding: 3px 7px;
  background: var(--field);
  color: var(--text-dim);
  border: 1px solid var(--border);
  cursor: pointer;
  box-shadow: var(--shadow-raise);
}

.tab:hover { background: var(--field-hover); }
.tab.active { background: var(--panel-raised); }

.pin { color: var(--accent); font-weight: 700; }

.actions { display: flex; gap: 3px; margin-left: auto; align-items: center; }

.sound {
  font-family: var(--mono);
  font-size: 10px;
  background: var(--field);
  color: var(--text);
  border: 1px solid var(--border);
  padding: 3px 5px;
  box-shadow: var(--shadow-inset);
}

.act {
  font-family: var(--mono);
  font-size: 11px;
  padding: 3px 7px;
  background: var(--field);
  color: var(--text-dim);
  border: 1px solid var(--border);
  cursor: pointer;
  box-shadow: var(--shadow-raise);
}

.act:hover { background: var(--field-hover); color: var(--text); }
.act.on { color: var(--accent); border-color: var(--accent); }

.body {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  padding: 3px 10px 6px;
  border-top: 1px solid var(--border-subtle);
}

.env {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.env-svg {
  width: 150px;
  height: 34px;
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: 3px;
}

.env-label {
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--text-faint);
}

.group {
  display: flex;
  flex-direction: column;
  gap: 1px;
  /* Wide enough that the slider stays grabbable. When the window cannot fit
     all four groups beside the envelope they wrap to a second row, which is
     better than squeezing every slider to a few dozen pixels. */
  min-width: 150px;
  flex: 1 1 150px;
}

.group-title {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--text-faint);
  font-weight: 700;
  margin-bottom: 1px;
}

/* Explanatory text, not a control: dimmer than the labels below it. Shown only
   when the ? toggle is on, so the default panel stays compact. */
.group-desc {
  font-size: 10px;
  line-height: 1.5;
  color: var(--text-dim);
  margin-bottom: 4px;
  max-width: 230px;
}

.sample {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
  max-width: 150px;
}

.s-size {
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--text-faint);
}

.sample.warn .s-size { color: var(--accent); }

.s-msg {
  font-size: 10px;
  line-height: 1.5;
  color: var(--text-dim);
}

.param {
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr) 42px;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  height: 15px;
}

.p-label {
  font-size: 10px;
  color: var(--text-dim);
  letter-spacing: 0.5px;
  white-space: nowrap; /* "LFO RATE" must not wrap inside the fixed-height row */
}

.p-value {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--text);
  text-align: right;
}

input[type='range'] {
  appearance: none;
  /* Let the slider shrink with its column instead of forcing the row wide. */
  min-width: 0;
  width: 100%;
  height: 3px;
  background: var(--field);
  border-radius: 2px;
  cursor: pointer;
}

input[type='range']::-webkit-slider-thumb {
  appearance: none;
  width: 9px;
  height: 13px;
  border-radius: 2px;
  background: var(--text-dim);
  cursor: pointer;
}

input[type='range']:hover::-webkit-slider-thumb { background: var(--accent); }
</style>
