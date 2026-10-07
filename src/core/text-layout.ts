// 共享文字排版核心：预览（DOM）与封面导出（Canvas）都只消费这里的结果，
// 不再各自折行/量字，确保「预览放得下」与「图片不截断」是同一条判定。
// 本模块为纯函数，宽度测量通过 TextMeasurer 注入（浏览器用 Canvas 2D，
// 无 DOM 环境回退到 estimateTextWidth），便于在两侧得到一致度量。

export type TextMeasurer = (text: string, fontSize: number, weight: number) => number;

export interface LaidLine {
  text: string;
  width: number;
}

export interface FitTextOptions {
  text: string;
  weight: number;
  minFontSize: number;
  maxFontSize: number;
  maxWidth: number;
  /** 可用高度（px）。折行结果随行高变化，因此也允许按当前字号/行高动态计算。 */
  maxHeight: number | ((fontSize: number, lineHeight: number) => number);
  lineHeightRatio: number;
}

export interface FittedText {
  lines: LaidLine[];
  fontSize: number;
  lineHeight: number;
  /** 最宽一行的宽度，用于绘制气泡底框。 */
  width: number;
  /** 内容总高（行数 * 行高），与 DOM 中行盒高度一致。 */
  height: number;
  /** 即使缩到最小字号仍放不下。调用方必须保留全部文字并阻止保存，不得截断。 */
  fit: boolean;
}

let graphemeSegmenter: Intl.Segmenter | undefined;
try {
  graphemeSegmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
} catch {
  graphemeSegmenter = undefined;
}

/** 按用户感知字符切分：ZWJ 表情序列、肤色修饰、代理对都作为整体，绝不拆开。 */
export function graphemes(text: string): string[] {
  if (graphemeSegmenter) return Array.from(graphemeSegmenter.segment(text), (item) => item.segment);
  return Array.from(text); // 回退：按码点切，仍能保住代理对
}

function isCodePointIn(value: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([start, end]) => value >= start && value <= end);
}

// 汉字、扩展区、兼容表意文字、CJK 标点与全角符号：字间即可断行。
const CJK_RANGES: Array<[number, number]> = [
  [0x2e80, 0x9fff],
  [0xf900, 0xfaff],
  [0x3000, 0x303f],
  [0xff00, 0xffef],
  [0x20000, 0x2ebe0],
];

function isCjk(grapheme: string): boolean {
  return isCodePointIn(grapheme.codePointAt(0) ?? 0, CJK_RANGES);
}

// 常见表情区段（含符号表情、Transport/地图符号等），测量时按近似 1em 宽估算。
const EMOJI_RANGES: Array<[number, number]> = [
  [0x1f300, 0x1f6ff],
  [0x1f900, 0x1faff],
  [0x2600, 0x27bf],
  [0x1f1e6, 0x1f1ff],
];

function isEmoji(grapheme: string): boolean {
  return isCodePointIn(grapheme.codePointAt(0) ?? 0, EMOJI_RANGES);
}

/** 无 Canvas 环境（如 jsdom / 单测）下的宽度估算，仅作回退，真实浏览器不走这里。 */
export function estimateTextWidth(text: string, fontSize: number, weight: number): number {
  let units = 0;
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (isCodePointIn(codePoint, EMOJI_RANGES)) {
      units += 1.05;
    } else if (codePoint < 0x80) {
      if (codePoint === 32) units += 0.32;
      else if (/[0-9A-Za-z]/.test(char)) units += weight >= 800 ? 0.6 : 0.56;
      else units += 0.52;
    } else {
      units += 1;
    }
  }
  return units * fontSize;
}

type TokenKind = 'word' | 'cjk' | 'space';
interface Token {
  text: string;
  kind: TokenKind;
}

function tokenize(paragraph: string): Token[] {
  const tokens: Token[] = [];
  let word = '';
  const flushWord = () => {
    if (word) {
      tokens.push({ text: word, kind: 'word' });
      word = '';
    }
  };
  for (const char of graphemes(paragraph)) {
    if (/^\s$/u.test(char)) {
      flushWord();
      tokens.push({ text: char, kind: 'space' });
    } else if (isCjk(char)) {
      flushWord();
      tokens.push({ text: char, kind: 'cjk' });
    } else {
      // 拉丁字母、数字、标点、表情都归入词；表情 ZWJ 序列已在字素切分时保持整体。
      word += char;
    }
  }
  flushWord();
  return tokens;
}

function wrapParagraph(paragraph: string, maxWidth: number, fontSize: number, weight: number, measure: TextMeasurer): string[] {
  const tokens = tokenize(paragraph);
  if (tokens.length === 0) return [''];
  const lines: string[] = [];
  let line = '';
  const widthOf = (value: string) => measure(value, fontSize, weight);
  const pushLine = () => {
    lines.push(line);
    line = '';
  };
  for (const token of tokens) {
    if (token.kind === 'space') {
      if (!line) continue; // 行首空白不占版面（不删原文，只是折叠排版空白）
      if (widthOf(line + token.text) <= maxWidth) {
        line += token.text;
      } else {
        pushLine(); // 该空白落在行首，丢弃
      }
    } else if (token.kind === 'cjk') {
      if (!line || widthOf(line + token.text) <= maxWidth) {
        line += token.text;
      } else {
        pushLine();
        line = token.text;
      }
    } else if (widthOf(token.text) <= maxWidth) {
      // 完整单词尽量整体移动
      if (!line || widthOf(line + token.text) <= maxWidth) {
        line += token.text;
      } else {
        pushLine();
        line = token.text;
      }
    } else {
      // 单个长单词/长串超过整行宽度：按字素硬切，每一个字符都保留。
      if (line) pushLine();
      for (const char of graphemes(token.text)) {
        if (!line) {
          line = char; // 即使单个字素超宽也保留，交由 fit=false 处理
        } else if (widthOf(line + char) <= maxWidth) {
          line += char;
        } else {
          pushLine();
          line = char;
        }
      }
    }
  }
  lines.push(line);
  return lines;
}

function wrapText(text: string, maxWidth: number, fontSize: number, weight: number, measure: TextMeasurer): LaidLine[] {
  const normalized = text.replace(/\r\n?/g, '\n');
  const paragraphs = normalized.split('\n');
  const lines: LaidLine[] = [];
  for (const paragraph of paragraphs) {
    for (const lineText of wrapParagraph(paragraph, maxWidth, fontSize, weight, measure)) {
      lines.push({ text: lineText, width: lineText ? measure(lineText, fontSize, weight) : 0 });
    }
  }
  return lines;
}

function blockHeight(lines: LaidLine[], lineHeight: number): number {
  return lines.length * lineHeight;
}

function blockWidth(lines: LaidLine[]): number {
  return lines.reduce((max, line) => Math.max(max, line.width), 0);
}

/**
 * 选取能同时满足宽高约束的最大字号。适配性随字号单调，因此二分查找：
 * 快速连续输入时每次按键只需约 6 轮度量即可完成，避免逐号试探造成输入卡顿。
 * 任何字号下都不删字；最小字号仍放不下时返回 fit=false。
 */
export function fitText(options: FitTextOptions, measure: TextMeasurer): FittedText {
  const { text, weight, minFontSize, maxFontSize, maxWidth, maxHeight, lineHeightRatio } = options;
  if (text.length === 0) {
    return { lines: [], fontSize: maxFontSize, lineHeight: maxFontSize * lineHeightRatio, width: 0, height: 0, fit: true };
  }
  const heightLimit = (fontSize: number, lineHeight: number) =>
    typeof maxHeight === 'function' ? maxHeight(fontSize, lineHeight) : maxHeight;

  const build = (fontSize: number): FittedText => {
    const lineHeight = fontSize * lineHeightRatio;
    const lines = wrapText(text, maxWidth, fontSize, weight, measure);
    return { lines, fontSize, lineHeight, width: blockWidth(lines), height: blockHeight(lines, lineHeight), fit: false };
  };

  const fits = (block: FittedText) =>
    block.lines.every((line) => line.width <= maxWidth) && block.height <= heightLimit(block.fontSize, block.lineHeight);

  let low = minFontSize;
  let high = maxFontSize;
  if (!fits(build(low))) {
    return { ...build(low), fit: false }; // 最小字号仍放不下：保留文字并标记溢出
  }
  let best = build(low);
  while (low <= high) {
    const mid = Math.round((low + high) / 2);
    const candidate = build(mid);
    if (fits(candidate)) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return { ...best, fit: true };
}
