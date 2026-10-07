import { COVER_FONT_STACK } from '../core/cover-layout';
import { estimateTextWidth, type TextMeasurer } from '../core/text-layout';

/**
 * 预览与导出共用的文字度量器：同一个 2D 上下文、同一字体栈，
 * 保证两侧换行决策基于完全相同的字形宽度。
 * 上下文惰性创建：模块加载时不触碰 DOM；无 Canvas 环境（jsdom 等）
 * 回退到纯估算，回退只影响测试环境，真实用户不会走这条路径。
 */
export function createTextMeasurer(createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')): TextMeasurer {
  let ctx: CanvasRenderingContext2D | undefined;
  let initialized = false;
  const ensureContext = () => {
    if (initialized) return ctx;
    initialized = true;
    try {
      ctx = createCanvas().getContext('2d') ?? undefined;
    } catch {
      ctx = undefined;
    }
    return ctx;
  };
  return (text, fontSize, weight) => {
    const context = ensureContext();
    if (!context) return estimateTextWidth(text, fontSize, weight);
    context.font = `${weight} ${fontSize}px ${COVER_FONT_STACK}`;
    return context.measureText(text).width; // advance width，对 CJK 比 actualBoundingBox 更安全
  };
}
