import { describe, expect, it } from 'vitest';
import { CanvasCoverRendererAdapter } from '../canvas-cover-renderer.adapter';
import { CoverLayoutError, graphemes, type TextMeasure } from '../../core/cover-layout';
import { coverPresetFor } from '../../core/cover-presets';
import type { CoverConfig } from '../../core/models';

// 确定性测量：全角 1em、半角 0.5em，避免测试依赖真实字体
const measure: TextMeasure = (text, font) => {
  const size = Number(/([\d.]+)px/.exec(font)?.[1] ?? 16);
  return graphemes(text).reduce((w, g) => w + (/[^\x00-\xff]/.test(g) ? size : size * 0.5), 0);
};

function mockCanvas(operations: string[]) {
  return {
    width: 0, height: 0,
    getContext: () => ({
      fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '', textBaseline: '', globalAlpha: 1,
      shadowColor: '', shadowOffsetX: 0, shadowOffsetY: 0,
      fillRect: () => operations.push('fillRect'), beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {},
      fillText: (text: string) => operations.push(`text:${text}`), save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {},
    }),
    toBlob: (callback: (blob: Blob) => void) => { operations.push('toBlob'); callback(new Blob(['png'], { type: 'image/png' })); },
  } as unknown as HTMLCanvasElement;
}

const configWith = (patch: Partial<CoverConfig>): CoverConfig => ({ ...coverPresetFor('阴阳怪气'), ...patch });

describe('CanvasCoverRendererAdapter', () => {
  it('applies ratio, filter and bubble text and returns PNG', async () => {
    const operations: string[] = [];
    const canvas = mockCanvas(operations);
    const config = configWith({ ratio: 'portrait', filter: 'mono', bubbleText: '你说得都对' });
    const blob = await new CanvasCoverRendererAdapter(() => canvas, measure).render(config, canvas);
    expect(canvas.width).toBe(900);
    expect(canvas.height).toBe(1200);
    expect(operations).toContain('text:你说得都对');
    expect(blob.type).toBe('image/png');
  });
  it('draws explicit line breaks as separate fillText calls', async () => {
    const operations: string[] = [];
    const canvas = mockCanvas(operations);
    const config = configWith({ bubbleText: '第一行\n第二行' });
    await new CanvasCoverRendererAdapter(() => canvas, measure).render(config, canvas);
    expect(operations).toContain('text:第一行');
    expect(operations).toContain('text:第二行');
  });
  it('refuses to export overflowing text instead of clipping it', async () => {
    const operations: string[] = [];
    const canvas = mockCanvas(operations);
    const config = configWith({ bubbleText: '好'.repeat(2000) });
    await expect(new CanvasCoverRendererAdapter(() => canvas, measure).render(config, canvas)).rejects.toBeInstanceOf(CoverLayoutError);
    expect(operations).not.toContain('toBlob'); // 未产出图片，调用方不会覆盖旧封面
  });
});
