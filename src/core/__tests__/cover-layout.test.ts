import { describe, expect, it } from 'vitest';
import { layoutCover } from '../cover-layout';
import { estimateTextWidth } from '../text-layout';
import { coverPresetFor } from '../cover-presets';

describe('layoutCover', () => {
  it('fits the presets on both ratios with shared geometry', () => {
    for (const label of ['暴躁老哥', '温柔姐姐', '阴阳怪气', '元气满满'] as const) {
      const square = layoutCover(coverPresetFor(label), estimateTextWidth);
      expect(square.fit).toBe(true);
      expect(square.width).toBe(900);
      expect(square.height).toBe(900);
      const portrait = layoutCover({ ...coverPresetFor(label), ratio: 'portrait' }, estimateTextWidth);
      expect(portrait.fit).toBe(true);
      expect(portrait.height).toBe(1200);
    }
  });

  it('shrinks the bubble font for a long mixed sentence and keeps every line inside the canvas', () => {
    const config = { ...coverPresetFor('元气满满'), bubbleText: '今天和朋友聊了很久superlongword真的超级开心😀哈哈，下次还要一起玩！' };
    const layout = layoutCover(config, estimateTextWidth);
    expect(layout.fit).toBe(true);
    expect(layout.bubble).toBeDefined();
    expect(layout.bubble!.text.fontSize).toBeLessThanOrEqual(42);
    const { centerX, boxWidth } = layout.bubble!;
    expect(centerX - boxWidth / 2).toBeGreaterThanOrEqual(0);
    expect(centerX + boxWidth / 2).toBeLessThanOrEqual(900);
  });

  it('preserves explicit newlines and keeps all text when overflow reports fit=false', () => {
    const paragraph = '第一行内容很长很长很长很长很长';
    const count = 20;
    const config = { ...coverPresetFor('元气满满'), bubbleText: Array(count).fill(paragraph).join('\n') };
    const layout = layoutCover(config, estimateTextWidth);
    expect(layout.fit).toBe(false);
    expect(layout.bubble).toBeDefined();
    const joined = layout.bubble!.text.lines.map((line) => line.text).join('');
    expect(joined.length).toBe(count * paragraph.length);
    expect(layout.bubble!.text.lines.length).toBeGreaterThanOrEqual(count);
  });

  it('re-evaluates fit when switching ratio, and empty bubble is skipped', () => {
    const overflow = { ...coverPresetFor('元气满满'), bubbleText: '满'.repeat(500) };
    expect(layoutCover(overflow, estimateTextWidth).fit).toBe(false);
    expect(layoutCover({ ...overflow, ratio: 'portrait' }, estimateTextWidth).fit).toBe(true);
    const empty = layoutCover({ ...coverPresetFor('元气满满'), bubbleText: '' }, estimateTextWidth);
    expect(empty.bubble).toBeUndefined();
    expect(empty.fit).toBe(true);
  });
});
