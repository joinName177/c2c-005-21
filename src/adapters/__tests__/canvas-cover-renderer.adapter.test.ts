import { describe, expect, it } from 'vitest';
import { CanvasCoverRendererAdapter } from '../canvas-cover-renderer.adapter';
import { estimateTextWidth } from '../../core/text-layout';
import { coverPresetFor } from '../../core/cover-presets';

function createFakeCanvas() {
  const operations: string[] = [];
  const context = {
    fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '', textBaseline: '', globalAlpha: 1,
    fillRect: () => operations.push('fill'), beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
    stroke: () => {}, arcTo: () => {}, closePath: () => {}, save: () => {}, restore: () => {},
    translate: () => {}, rotate: () => {}, fill: () => {},
    fillText: (text: string) => operations.push(text),
  };
  const canvas = {
    width: 0, height: 0,
    getContext: () => context,
    toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob(['png'], { type: 'image/png' })),
  } as unknown as HTMLCanvasElement;
  return { canvas, operations };
}

describe('CanvasCoverRendererAdapter', () => {
  it('applies ratio, filter and multi-line bubble text from the shared layout and returns PNG', async () => {
    const { canvas, operations } = createFakeCanvas();
    const config = { ...coverPresetFor('阴阳怪气'), ratio: 'portrait' as const, filter: 'mono' as const, bubbleText: '你说得都对\n真的' };
    const blob = await new CanvasCoverRendererAdapter(() => canvas, estimateTextWidth).render(config, canvas);
    expect(canvas.width).toBe(900);
    expect(canvas.height).toBe(1200);
    expect(operations).toContain('你说得都对');
    expect(operations).toContain('真的'); // 显式换行的第二行逐行绘制，不再被单行 fillText 吞掉
    expect(blob.type).toBe('image/png');
  });

  it('refuses to export when text cannot fit instead of clipping characters', async () => {
    const { canvas } = createFakeCanvas();
    const longText = '超'.repeat(800);
    const config = { ...coverPresetFor('元气满满'), bubbleText: longText };
    await expect(new CanvasCoverRendererAdapter(() => canvas, estimateTextWidth).render(config, canvas)).rejects.toThrow(/无法完整显示/);
  });
});
