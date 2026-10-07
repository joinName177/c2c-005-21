import type { TextMeasure } from '../core/cover-layout';

/** 无 2D 上下文环境（如 jsdom）的兜底测量：全角按 1em、半角按 0.56em 估算，保证排版逻辑仍可运行 */
export const approximateTextMeasure: TextMeasure = (text, font) => {
  const size = Number(/([\d.]+)px/.exec(font)?.[1] ?? 16);
  let width = 0;
  for (const char of Array.from(text)) width += (char.codePointAt(0) ?? 0) > 0xff ? size : size * 0.56;
  return width;
};

/**
 * 基于 canvas 的文字测量。预览排版与封面导出使用同一字体串、同一测量口径，
 * 因此两边算出的换行点和字号完全一致。
 */
export function createCanvasTextMeasure(): TextMeasure {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) return (text, font) => { ctx.font = font; return ctx.measureText(text).width; };
  } catch { /* jsdom 等无 canvas 环境 */ }
  return approximateTextMeasure;
}
