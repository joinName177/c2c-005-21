import { describe, expect, it } from 'vitest';
import { BUBBLE_PAD, computeCoverLayout, graphemes, type TextMeasure } from '../cover-layout';
import { coverPresetFor } from '../cover-presets';
import type { CoverConfig } from '../models';

// 确定性测量：全角（中文/emoji）1em，半角 0.5em，与字号成正比
const measure: TextMeasure = (text, font) => {
  const size = Number(/([\d.]+)px/.exec(font)?.[1] ?? 16);
  return graphemes(text).reduce((w, g) => w + (/[^\x00-\xff]/.test(g) ? size : size * 0.5), 0);
};
const configWith = (patch: Partial<CoverConfig>): CoverConfig => ({ ...coverPresetFor('元气满满'), ...patch });
const joined = (lines: { text: string }[]) => lines.map((l) => l.text).join('');

describe('computeCoverLayout', () => {
  it('保留显式换行，包括空行', () => {
    const layout = computeCoverLayout(configWith({ bubbleText: '第一行\n第二行\n\n第四行' }), measure);
    expect(layout.bubble.lines.map((l) => l.text)).toEqual(['第一行', '第二行', '', '第四行']);
  });
  it('中文按宽度换行且不丢字', () => {
    const text = '今天的心情真的非常非常非常不错呀'; // 16 字，标题 92px 时每行最多 8 字
    const layout = computeCoverLayout(configWith({ title: text }), measure);
    expect(layout.title.lines.length).toBe(2);
    expect(joined(layout.title.lines)).toBe(text);
    for (const line of layout.title.lines) expect(line.width).toBeLessThanOrEqual(780);
  });
  it('英文单词整体换行，不在词中断开', () => {
    const layout = computeCoverLayout(configWith({ title: '你好 helloworld 你好' }), measure);
    expect(layout.title.lines.map((l) => l.text)).toEqual(['你好 helloworld', '你好']);
  });
  it('超长单词按字素硬拆，仍然不丢字', () => {
    const longWord = 'x'.repeat(40); // 42px 时整词 840px 超出气泡行宽 684px
    const layout = computeCoverLayout(configWith({ bubbleText: longWord }), measure);
    expect(layout.bubble.lines.length).toBeGreaterThan(1);
    expect(joined(layout.bubble.lines)).toBe(longWord);
    for (const line of layout.bubble.lines) expect(line.width).toBeLessThanOrEqual(684 + 1e-6);
  });
  it('emoji 作为整体参与换行，ZWJ 组合不被拆散', () => {
    const emoji = '👨‍👩‍👧‍👦'.repeat(20); // 20 × 42px = 840px，需两行
    const layout = computeCoverLayout(configWith({ bubbleText: emoji }), measure);
    expect(layout.bubble.lines.length).toBe(2);
    expect(joined(layout.bubble.lines)).toBe(emoji);
    expect(graphemes(layout.bubble.lines[0].text).length).toBe(16);
  });
  it('行数过多时自动缩小字号直到放得下', () => {
    const layout = computeCoverLayout(configWith({ bubbleText: '好'.repeat(200) }), measure);
    expect(layout.bubble.fontSize).toBeLessThan(42);
    expect(layout.bubble.overflow).toBe(false);
    expect(joined(layout.bubble.lines)).toBe('好'.repeat(200));
  });
  it('缩到最小字号仍放不下时标记 overflow，且完整保留文字', () => {
    const huge = '好'.repeat(2000);
    const layout = computeCoverLayout(configWith({ bubbleText: huge }), measure);
    expect(layout.bubble.overflow).toBe(true);
    expect(layout.bubble.fontSize).toBe(18);
    expect(layout.overflow).toBe(true);
    expect(joined(layout.bubble.lines)).toBe(huge);
  });
  it('切换比例后按新画布高度重新排版', () => {
    const text = '好'.repeat(600);
    const square = computeCoverLayout(configWith({ bubbleText: text, ratio: 'square' }), measure);
    const portrait = computeCoverLayout(configWith({ bubbleText: text, ratio: 'portrait' }), measure);
    expect(square.bubble.overflow).toBe(true);
    expect(portrait.bubble.overflow).toBe(false);
  });
  it('气泡位置贴边时整体钳制回画布安全区', () => {
    const layout = computeCoverLayout(configWith({ bubbleX: 0, bubbleY: 100, bubbleText: '靠边站' }), measure);
    expect(layout.bubble.centerX).toBeGreaterThanOrEqual(layout.bubble.width / 2 + BUBBLE_PAD.x + 28 - 1e-6);
    expect(layout.bubble.centerY).toBeLessThanOrEqual(900 - (layout.bubble.height / 2 + BUBBLE_PAD.y + 28) + 1e-6);
  });
  it('空文本不产生行，也不算溢出', () => {
    const layout = computeCoverLayout(configWith({ title: '', bubbleText: '   ' }), measure);
    expect(layout.title.lines).toEqual([]);
    expect(layout.bubble.lines).toEqual([]);
    expect(layout.overflow).toBe(false);
  });
});
