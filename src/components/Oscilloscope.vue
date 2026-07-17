<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { store } from '../store';

const canvas = ref<HTMLCanvasElement | null>(null);
let raf = 0;
let data: Uint8Array | null = null;

function draw() {
  raf = requestAnimationFrame(draw);
  const el = canvas.value;
  if (!el) return;
  const ctx = el.getContext('2d');
  if (!ctx) return;

  const w = el.width;
  const h = el.height;
  ctx.fillStyle = '#131419';
  ctx.fillRect(0, 0, w, h);

  const analyser = store.state.isPlaying ? store.getAnalyser() : null;
  ctx.strokeStyle = '#ff8a2a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  if (analyser) {
    if (!data || data.length !== analyser.fftSize) data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data as Uint8Array<ArrayBuffer>);
    const step = w / data.length;
    for (let i = 0; i < data.length; i++) {
      const y = (data[i] / 255) * h;
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(i * step, y);
    }
  } else {
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
  }
  ctx.stroke();
}

onMounted(() => {
  raf = requestAnimationFrame(draw);
});
onUnmounted(() => cancelAnimationFrame(raf));
</script>

<template>
  <canvas ref="canvas" class="scope" width="140" height="30" title="Oscilloscope" />
</template>

<style scoped>
.scope {
  border: 1px solid var(--border);
  display: block;
}
</style>
