import { describe, expect, it } from 'vitest';
import { estimateTextWidth, fitText, graphemes } from '../text-layout';

// estimateTextWidth 内部按调用时传入的字号换算，因此直接用它即可在固定字号下验证折行。
function wrap(text: string, maxWidth: number, fontSize = 42, weight = 700) {
  return fitText(
    { text, weight, minFontSize: fontSize, maxFontSize: fontSize, maxWidth, maxHeight: 10_000, lineHeightRatio: 1.2 },
    estimateTextWidth,
  );
}

const textOf = (lines: { text: string }[]) => lines.map((line) => line.text).join('');

describe('text-layout', () => {
  it('keeps ZWJ emoji sequences and surrogate pairs as single graphemes', () => {
    expect(graphemes('👨‍👩‍👧‍👦')).toEqual(['👨‍👩‍👧‍👦']);
    expect(graphemes('嗨😀x')).toEqual(['嗨', '😀', 'x']);
  });

  it('wraps CJK between any characters and respects explicit line breaks', () => {
    const result = wrap('今天元气超标了\n第二行哦', 5 * 42);
    expect(result.lines.length).toBeGreaterThanOrEqual(3);
    expect(result.lines.map((l) => l.text)).toContain('第二行哦');
  });

  it('keeps latin words intact and hard-breaks only an oversized long word', () => {
    const result = wrap('hello supercalifragilisticexpialidocious 世界', 150);
    expect(result.lines.some((line) => line.text.startsWith('hello'))).toBe(true);
    // 普通单词整体换行；超长单词按字素硬切，字符不丢。
    expect(textOf(result.lines).replace(/\s/g, '')).toContain('supercalifragilisticexpialidocious');
    expect(result.lines.length).toBeGreaterThan(3);
    expect(result.lines.some((line) => line.text.includes('世'))).toBe(true);
  });

  it('hard-breaks a long word without losing characters', () => {
    const result = wrap('supercalifragilisticexpialidocious', 120);
    expect(textOf(result.lines)).toBe('supercalifragilisticexpialidocious');
    expect(result.lines.length).toBeGreaterThan(1);
  });

  it('shrinks font size for tall content', () => {
    const result = fitText(
      { text: '一二三四五六', weight: 700, minFontSize: 20, maxFontSize: 42, maxWidth: 200, maxHeight: 40, lineHeightRatio: 1.2 },
      estimateTextWidth,
    );
    expect(result.fit).toBe(true);
    expect(result.fontSize).toBeLessThan(42);
    expect(textOf(result.lines)).toBe('一二三四五六');
  });

  it('reports fit=false at the minimum size without dropping any character', () => {
    const overflow = fitText(
      { text: '字'.repeat(500), weight: 700, minFontSize: 20, maxFontSize: 42, maxWidth: 120, maxHeight: 40, lineHeightRatio: 1.2 },
      estimateTextWidth,
    );
    expect(overflow.fit).toBe(false);
    expect(overflow.fontSize).toBe(20);
    expect(textOf(overflow.lines).length).toBe(500);
  });

  it('never splits a single emoji across lines', () => {
    const result = wrap('a🎉🎉🎉🎉🎉🎉', 130);
    expect(textOf(result.lines).split('🎉').length - 1).toBe(6);
    expect(result.lines.every((line) => !line.text.includes('‍'))).toBe(true);
  });

  it('normalizes CRLF and keeps empty lines from consecutive breaks', () => {
    const result = wrap('第一行\r\n\r\n第三行', 500);
    expect(result.lines.map((line) => line.text)).toEqual(['第一行', '', '第三行']);
  });
});
