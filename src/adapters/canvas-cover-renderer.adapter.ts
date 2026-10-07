import type { CoverConfig } from '../core/models';
import { BUBBLE_PAD, BUBBLE_ROTATE_DEG, CoverLayoutError, computeCoverLayout, coverCanvasSpec, type TextBlockLayout, type TextMeasure } from '../core/cover-layout';
import type { CoverRendererPort } from '../ports/cover-renderer.port';
import { createCanvasTextMeasure } from './canvas-text-measure.adapter';

export class CanvasCoverRendererAdapter implements CoverRendererPort {
  constructor(
    private readonly createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
    private measure?: TextMeasure,
  ) {}

  async render(config: CoverConfig, target?: HTMLCanvasElement): Promise<Blob> {
    const canvas = target ?? this.createCanvas();
    const spec = coverCanvasSpec(config.ratio);
    canvas.width = spec.width; canvas.height = spec.height;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('当前浏览器无法创建 Canvas');
    // 与预览共用同一份排版结果；缩到最小字号仍放不下时拒绝导出，绝不截断或删字
    this.measure ??= createCanvasTextMeasure();
    const layout = computeCoverLayout(config, this.measure);
    if (layout.overflow) throw new CoverLayoutError('封面文字超出可绘制区域，文字已完整保留，请删减内容或调整换行后再保存');

    ctx.fillStyle = config.palette[0]; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = config.filter === 'mono' ? .45 : .72; ctx.fillStyle = config.palette[1]; ctx.fillRect(60, 60, canvas.width - 120, canvas.height - 120); ctx.globalAlpha = 1;
    ctx.strokeStyle = config.palette[2]; ctx.lineWidth = 14; ctx.beginPath(); for (let x = 0; x <= canvas.width; x += 30) { const y = canvas.height * .43 + Math.sin(x / 35) * 62; if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();

    // 标题：按排版结果逐行绘制，带与预览一致的投影
    ctx.save();
    ctx.fillStyle = config.palette[2];
    ctx.shadowColor = '#1a0c29'; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 5;
    this.drawLines(ctx, layout.title);
    ctx.restore();

    // 气泡：白底 pill + 深色文字，与预览同款
    const bubble = layout.bubble;
    if (bubble.lines.length) {
      ctx.save();
      ctx.translate(bubble.centerX, bubble.centerY);
      ctx.rotate(BUBBLE_ROTATE_DEG * Math.PI / 180);
      const w = bubble.width + BUBBLE_PAD.x * 2; const h = bubble.height + BUBBLE_PAD.y * 2;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#28133b';
      ctx.font = bubble.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      bubble.lines.forEach((line, index) => ctx.fillText(line.text, 0, (index + 0.5) * bubble.lineHeight - bubble.height / 2));
      ctx.restore();
    }
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('封面导出失败')), 'image/png'));
  }

  private drawLines(ctx: CanvasRenderingContext2D, block: TextBlockLayout): void {
    ctx.font = block.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const top = block.centerY - block.height / 2;
    block.lines.forEach((line, index) => ctx.fillText(line.text, block.centerX, top + (index + 0.5) * block.lineHeight));
  }
}
