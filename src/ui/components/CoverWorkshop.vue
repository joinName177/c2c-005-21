<script setup lang="ts">
import { computed } from 'vue';
import type { CoverConfig } from '../../core/models';
import { BUBBLE_PAD, BUBBLE_ROTATE_DEG, COVER_EXPORT_WIDTH, computeCoverLayout, type TextBlockLayout } from '../../core/cover-layout';
import { createCanvasTextMeasure } from '../../adapters/canvas-text-measure.adapter';

const props = withDefaults(defineProps<{ config: CoverConfig; title: string; saving?: boolean }>(), { saving: false });
const emit = defineEmits<{ patch: [p: Partial<CoverConfig>]; title: [t: string]; save: [] }>();

// 与封面导出共用同一测量口径和同一排版函数：预览即所见，不会“预览放得下、图片被截断”
const measure = createCanvasTextMeasure();
const layout = computed(() => computeCoverLayout(props.config, measure));
const pctX = (v: number) => `${(v / layout.value.width * 100).toFixed(3)}%`;
const pctY = (v: number) => `${(v / layout.value.height * 100).toFixed(3)}%`;
// 预览容器按导出宽度 900px 等比缩放（container query），缩放不改变换行点
const cqw = (px: number) => `${(px / COVER_EXPORT_WIDTH * 100).toFixed(3)}cqw`;
const lh = (b: TextBlockLayout) => (b.fontSize ? (b.lineHeight / b.fontSize).toFixed(4) : '1.2');
</script>

<template>
  <section class="cover-layout">
    <div class="stage-card controls">
      <span class="kicker">04 / COVER LAB</span>
      <h2>给声音穿件有戏的外套</h2>
      <label>作品名称<input :value="title" @input="emit('title', ($event.target as HTMLInputElement).value)"></label>
      <label>气泡文字<textarea aria-label="气泡文字" rows="4" :value="config.bubbleText" @input="emit('patch', { bubbleText: ($event.target as HTMLTextAreaElement).value })"></textarea></label>
      <label>滤镜<select :value="config.filter" @change="emit('patch', { filter: ($event.target as HTMLSelectElement).value as CoverConfig['filter'] })"><option value="none">原色</option><option value="mono">黑白</option><option value="saturate">高饱和</option><option value="warm">暖调</option><option value="cool">冷调</option></select></label>
      <label>比例<select :value="config.ratio" @change="emit('patch', { ratio: ($event.target as HTMLSelectElement).value as CoverConfig['ratio'] })"><option value="square">方形 1:1</option><option value="portrait">竖版 3:4</option></select></label>
      <p v-if="layout.overflow" class="cover-warning" role="alert">封面安全区放不下这些文字（已缩到最小字号）。文字已完整保留，请删减、手动换行或切换比例后再保存。</p>
      <button data-testid="save-work" class="acid-button" type="button" :disabled="saving || layout.overflow" @click="emit('save')">{{ saving ? '保存中…' : '保存作品' }}</button>
    </div>
    <div class="cover-preview" :class="[config.ratio, config.filter]" :style="{ '--c1': config.palette[0], '--c2': config.palette[1], '--c3': config.palette[2] }">
      <span>SOUND REACTION / 005</span>
      <div class="burst"></div>
      <div class="cover-title" :style="{ top: pctY(layout.title.centerY - layout.title.height / 2), fontSize: cqw(layout.title.fontSize), lineHeight: lh(layout.title), color: config.palette[2], fontWeight: layout.title.fontWeight }"><span v-for="(line, i) in layout.title.lines" :key="i">{{ line.text || ' ' }}</span></div>
      <div v-if="layout.bubble.lines.length" class="cover-bubble" :style="{ left: pctX(layout.bubble.centerX), top: pctY(layout.bubble.centerY), fontSize: cqw(layout.bubble.fontSize), lineHeight: lh(layout.bubble), fontWeight: layout.bubble.fontWeight, padding: `${cqw(BUBBLE_PAD.y)} ${cqw(BUBBLE_PAD.x)}`, transform: `translate(-50%, -50%) rotate(${BUBBLE_ROTATE_DEG}deg)` }"><span v-for="(line, i) in layout.bubble.lines" :key="i">{{ line.text || ' ' }}</span></div>
      <i>▶ PLAY IT</i>
    </div>
  </section>
</template>
