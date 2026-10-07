<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { CoverConfig } from '../../core/models';
import type { CoverLayout } from '../../core/cover-layout';
import { BUBBLE_CORNER_RADIUS, BUBBLE_ROTATION, COVER_FONT_STACK } from '../../core/cover-layout';

const props = defineProps<{ config: CoverConfig; layout: CoverLayout; title: string; saving?: boolean }>();
const emit = defineEmits<{ patch: [p: Partial<CoverConfig>]; title: [t: string]; save: [] }>();

// 设计稿固定 900 基准宽，预览只做整体等比缩放：换行、字号、坐标全部沿用
// 导出绘制所用的同一份 layout，DOM 不再自行决定文字断行。
const stage = ref<HTMLElement>();
const scale = ref(0.5);
let observer: ResizeObserver | undefined;
onMounted(() => {
  if (stage.value && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) scale.value = width / props.layout.width;
    });
    observer.observe(stage.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());

const stageStyle = () => ({
  width: `${props.layout.width}px`,
  height: `${props.layout.height}px`,
  transform: `scale(${scale.value})`,
  transformOrigin: 'top left',
});
const titleWidth = computed(() => props.layout.title.text.lines.reduce((max, line) => Math.max(max, line.width), 0));
</script>

<template>
  <section class="cover-layout">
    <div class="stage-card controls">
      <span class="kicker">04 / COVER LAB</span>
      <h2>给声音穿件有戏的外套</h2>
      <label>作品名称<input :value="title" @input="emit('title',($event.target as HTMLInputElement).value)"></label>
      <label>封面标题<input aria-label="封面标题" :value="config.title" @input="emit('patch',{title:($event.target as HTMLInputElement).value})"></label>
      <label>气泡文字<textarea aria-label="气泡文字" :value="config.bubbleText" @input="emit('patch',{bubbleText:($event.target as HTMLTextAreaElement).value})"></textarea></label>
      <label>滤镜<select :value="config.filter" @change="emit('patch',{filter:($event.target as HTMLSelectElement).value as CoverConfig['filter']})"><option value="none">原色</option><option value="mono">黑白</option><option value="saturate">高饱和</option><option value="warm">暖调</option><option value="cool">冷调</option></select></label>
      <label>比例<select :value="config.ratio" @change="emit('patch',{ratio:($event.target as HTMLSelectElement).value as CoverConfig['ratio']})"><option value="square">方形 1:1</option><option value="portrait">竖版 3:4</option></select></label>
      <p v-if="!layout.fit" class="cover-overflow" role="alert">文字在当前比例下放不下：全部文字仍保留在画面中并完整绘制，但需删减内容、调整换行或更换比例后才能保存。</p>
      <button data-testid="save-work" class="acid-button" type="button" :disabled="!layout.fit || saving" @click="emit('save')">
        {{ saving ? '正在保存…' : layout.fit ? '保存作品' : '文字超出，无法保存' }}
      </button>
    </div>
    <div ref="stage" class="cover-preview" :class="[config.ratio,config.filter]" :style="{'--c1':config.palette[0],'--c2':config.palette[1],'--c3':config.palette[2]}">
      <div class="cover-stage" :style="{...stageStyle(),'--cover-font':COVER_FONT_STACK}">
        <span class="cover-kicker">SOUND REACTION / 005</span>
        <div class="burst"></div>
        <h3 class="cover-title" :style="{width:`${titleWidth}px`,left:`${layout.title.centerX}px`,top:`${layout.title.top}px`,'--title-size':`${layout.title.text.fontSize}px`,'--title-lh':`${layout.title.text.lineHeight}px`}">
          <span v-for="(line,i) in layout.title.text.lines" :key="i" class="cover-line">{{ line.text }}</span>
        </h3>
        <div v-if="layout.bubble" class="cover-bubble" :class="{overflow:!layout.fit}" :style="{left:`${layout.bubble.centerX}px`,top:`${layout.bubble.centerY}px`,width:`${layout.bubble.boxWidth}px`,height:`${layout.bubble.boxHeight}px`,transform:`translate(-50%,-50%) rotate(${BUBBLE_ROTATION}deg)`,'--bubble-radius':`${BUBBLE_CORNER_RADIUS}px`,'--bubble-size':`${layout.bubble.text.fontSize}px`,'--bubble-lh':`${layout.bubble.text.lineHeight}px`,'--bubble-pad-y':`${(layout.bubble.boxHeight-layout.bubble.text.height)/2}px`}">
          <span v-for="(line,i) in layout.bubble.text.lines" :key="i" class="cover-line">{{ line.text }}</span>
        </div>
        <i class="cover-play">▶ PLAY IT</i>
      </div>
    </div>
  </section>
</template>
