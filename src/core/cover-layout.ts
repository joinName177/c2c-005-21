import type { CoverConfig } from './models';

/**
 * 封面文字排版引擎：预览与导出共用的唯一排版依据。
 * 纯函数、不依赖 DOM，测量能力由调用方注入（浏览器用 canvas measureText，
 * 测试/无 canvas 环境用近似测量），保证两边换行点、字号、位置完全一致。
 */

export const COVER_EXPORT_WIDTH = 900;
export const COVER_EXPORT_HEIGHT: Record<CoverConfig['ratio'], number> = { square: 900, portrait: 1200 };
/** 气泡白底 pill 的内边距与旋转角（导出像素/度），预览用 cqw 等比复用 */
export const BUBBLE_PAD = { x: 26, y: 16 } as const;
export const BUBBLE_ROTATE_DEG = -3;
const SAFE_MARGIN = 28;

export type TextMeasure = (text: string, font: string) => number;

export interface LayoutLine { text: string; width: number }
export interface TextBlockLayout {
  lines: LayoutLine[];
  font: string;
  fontWeight: number;
  fontSize: number;
  lineHeight: number;
  /** 内容宽高（导出像素） */
  width: number;
  height: number;
  /** 块中心（导出像素坐标） */
  centerX: number;
  centerY: number;
  overflow: boolean;
}
export interface CoverLayout {
  width: number;
  height: number;
  title: TextBlockLayout;
  bubble: TextBlockLayout;
  overflow: boolean;
}

/** 排版放不下时抛出，用于阻止保存而不是悄悄截断 */
export class CoverLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoverLayoutError';
  }
}

export function coverCanvasSpec(ratio: CoverConfig['ratio']): { width: number; height: number } {
  return { width: COVER_EXPORT_WIDTH, height: COVER_EXPORT_HEIGHT[ratio] };
}

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : undefined;

/** 按字素簇切分，emoji（含 ZWJ 组合、旗帜）不会被拆散 */
export function graphemes(text: string): string[] {
  if (!text) return [];
  if (segmenter) return Array.from(segmenter.segment(text), (part) => part.segment);
  return Array.from(text);
}

const WORD_CHAR = /^[A-Za-z0-9]$/;

/** 英文/数字连续段作为整体 token（不断词），其余按字素簇逐一切分（中文、emoji 可任意断行） */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let word = '';
  for (const g of graphemes(text)) {
    if (WORD_CHAR.test(g)) { word += g; continue; }
    if (word) { tokens.push(word); word = ''; }
    tokens.push(g);
  }
  if (word) tokens.push(word);
  return tokens;
}

function wrapParagraph(paragraph: string, font: string, maxWidth: number, measure: TextMeasure): LayoutLine[] {
  const lines: LayoutLine[] = [];
  let current = '';
  const pushCurrent = () => {
    const text = current.trimEnd();
    lines.push({ text, width: text ? measure(text, font) : 0 });
    current = '';
  };
  for (const token of tokenize(paragraph)) {
    if (token === ' ' && !current) continue; // 行首空格省略
    if (measure(token, font) > maxWidth) {
      // 单个 token 超宽（长单词/长串）：按字素簇硬拆，只换行不删字
      if (current) pushCurrent();
      let chunk = '';
      for (const g of graphemes(token)) {
        if (chunk && measure(chunk + g, font) > maxWidth) {
          lines.push({ text: chunk, width: measure(chunk, font) });
          chunk = g;
        } else chunk += g;
      }
      current = chunk;
      continue;
    }
    const candidate = current + token;
    if (!current || measure(candidate, font) <= maxWidth) current = candidate;
    else { pushCurrent(); current = token === ' ' ? '' : token; }
  }
  if (current) pushCurrent();
  if (!lines.length) lines.push({ text: '', width: 0 }); // 显式空行也占位
  return lines;
}

interface BlockSpec {
  weight: number;
  startSize: number;
  minSize: number;
  lineHeightRatio: number;
  maxWidth: number;
  maxHeight: number;
}

const fontString = (weight: number, size: number) => `${weight} ${size}px sans-serif`;

/** 同一套换行 + 自动缩字号逻辑：标题、气泡都走这里，只是规格不同 */
function fitBlock(text: string, spec: BlockSpec, measure: TextMeasure): Omit<TextBlockLayout, 'centerX' | 'centerY'> {
  if (!text.trim()) {
    return { lines: [], font: fontString(spec.weight, spec.startSize), fontWeight: spec.weight, fontSize: spec.startSize, lineHeight: Math.round(spec.startSize * spec.lineHeightRatio), width: 0, height: 0, overflow: false };
  }
  const paragraphs = text.replace(/\r\n?/g, '\n').split('\n');
  for (let size = spec.startSize; ; size = Math.max(spec.minSize, Math.floor(size * 0.9))) {
    const font = fontString(spec.weight, size);
    const lines = paragraphs.flatMap((p) => wrapParagraph(p, font, spec.maxWidth, measure));
    const lineHeight = Math.round(size * spec.lineHeightRatio);
    const height = lines.length * lineHeight;
    if (height <= spec.maxHeight || size <= spec.minSize) {
      const width = lines.reduce((max, line) => Math.max(max, line.width), 0);
      return { lines, font, fontWeight: spec.weight, fontSize: size, lineHeight, width, height, overflow: height > spec.maxHeight };
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function computeCoverLayout(config: CoverConfig, measure: TextMeasure): CoverLayout {
  const { width, height } = coverCanvasSpec(config.ratio);
  const titleFit = fitBlock(config.title, {
    weight: 900, startSize: 92, minSize: 30, lineHeightRatio: 1.16,
    maxWidth: width - 120, maxHeight: height * 0.3,
  }, measure);
  const title: TextBlockLayout = { ...titleFit, centerX: width / 2, centerY: height * 0.15 + titleFit.height / 2 };

  const bubbleFit = fitBlock(config.bubbleText, {
    weight: 700, startSize: 42, minSize: 18, lineHeightRatio: 1.3,
    maxWidth: width * 0.76, maxHeight: height * 0.34,
  }, measure);
  // 气泡块（含白底内边距）整体钳制在画布安全区内，任何 bubbleX/Y 都不会画出界
  const halfW = bubbleFit.width / 2 + BUBBLE_PAD.x;
  const halfH = bubbleFit.height / 2 + BUBBLE_PAD.y;
  const bubble: TextBlockLayout = {
    ...bubbleFit,
    centerX: clamp(width * config.bubbleX / 100, halfW + SAFE_MARGIN, width - halfW - SAFE_MARGIN),
    centerY: clamp(height * config.bubbleY / 100, halfH + SAFE_MARGIN, height - halfH - SAFE_MARGIN),
  };
  return { width, height, title, bubble, overflow: title.overflow || bubble.overflow };
}
