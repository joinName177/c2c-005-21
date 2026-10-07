import type { CoverConfig } from '../core/models';
import {
  BUBBLE_CORNER_RADIUS,
  BUBBLE_ROTATION,
  BUBBLE_WEIGHT,
  COVER_FONT_STACK,
  TITLE_WEIGHT,
  layoutCover,
} from '../core/cover-layout';
import { createTextMeasurer } from './text-measurer.adapter';
import type { CoverRendererPort } from '../ports/cover-renderer.port';

export class CanvasCoverRendererAdapter implements CoverRendererPort {
  constructor(
    private readonly createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
    private readonly measure = createTextMeasurer(() => document.createElement('canvas')),
  ) {}

  async render(config: CoverConfig, target?: HTMLCanvasElement): Promise<Blob> {
    // 先排版、后绘制：导出与预览使用同一个 layoutCover 结果，绝不在绘制侧自行折行。
    const layout = layoutCover(config, this.measure);
    if (!layout.fit) {
      // 兜底防线：UI 已禁用保存；即使被绕过也不导出截断图，保留全部文字。
      throw new Error('文字在当前比例下无法完整显示，请缩短文字或更换比例后再保存');
    }

    const canvas = target ?? this.createCanvas();
    canvas.width = layout.width;
    canvas.height = layout.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('当前浏览器无法创建 Canvas');

    ctx.fillStyle = config.palette[0];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = config.filter === 'mono' ? 0.45 : 0.72;
    ctx.fillStyle = config.palette[1];
    ctx.fillRect(60, 60, canvas.width - 120, canvas.height - 120);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = config.palette[2];
    ctx.lineWidth = 14;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 30) {
      const y = canvas.height * 0.43 + Math.sin(x / 35) * 62;
      if (!x) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // 标题：逐行按共享布局绘制，字号/换行与预览完全一致。
    const title = layout.title.text;
    ctx.fillStyle = config.palette[2];
    ctx.font = `${TITLE_WEIGHT} ${title.fontSize}px ${COVER_FONT_STACK}`;
    title.lines.forEach((line, index) => {
      ctx.fillText(line.text, layout.title.centerX, layout.title.top + index * title.lineHeight);
    });

    // 气泡：圆角底框 + 整体旋转，多行文本逐行绘制；显式换行原样保留。
    if (layout.bubble) {
      const bubble = layout.bubble;
      const text = bubble.text;
      ctx.save();
      ctx.translate(bubble.centerX, bubble.centerY);
      ctx.rotate((BUBBLE_ROTATION * Math.PI) / 180);
      roundedRect(ctx, -bubble.boxWidth / 2, -bubble.boxHeight / 2, bubble.boxWidth, bubble.boxHeight, BUBBLE_CORNER_RADIUS);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.fillStyle = '#28133b';
      ctx.font = `${BUBBLE_WEIGHT} ${text.fontSize}px ${COVER_FONT_STACK}`;
      const firstLineTop = -text.height / 2;
      text.lines.forEach((line, index) => {
        ctx.fillText(line.text, 0, firstLineTop + index * text.lineHeight);
      });
      ctx.restore();
    }

    return new Promise((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('封面导出失败'))), 'image/png'),
    );
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
