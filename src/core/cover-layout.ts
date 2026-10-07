import type { CoverConfig } from './models';
import { fitText, type FittedText, type TextMeasurer } from './text-layout';

// 导出画布以 900 为基准宽（竖版 900x1200 / 方形 900x900）。预览把同一套
// 设计坐标整体缩放到显示尺寸，因此文字位置、换行、字号两侧完全一致。
export const COVER_BASE_WIDTH = 900;
export const COVER_FONT_STACK = 'Inter,"PingFang SC","Microsoft YaHei",sans-serif';
export const TITLE_WEIGHT = 900;
export const BUBBLE_WEIGHT = 700;
export const TITLE_LINE_HEIGHT = 1.04;
export const BUBBLE_LINE_HEIGHT = 1.28;
const TITLE_MIN = 30;
const TITLE_MAX = 92;
const BUBBLE_MIN = 20;
const BUBBLE_MAX = 42;
const TITLE_TOP = 0.16; // 标题块上边界（占画布高比例）
const TITLE_ANCHOR_Y = 0.3; // 标题块顶端向这里收拢，复刻旧导出的标题位置
const TITLE_MAX_WIDTH = 640;
const BUBBLE_MAX_WIDTH = 600;
const BUBBLE_PAD_X = 30;
const BUBBLE_PAD_Y = 22;
export const BUBBLE_CORNER_RADIUS = 26;
export const BUBBLE_ROTATION = -3;

export interface BubbleLayout {
  /** 气泡中心（设计坐标，即导出画布像素）。 */
  centerX: number;
  centerY: number;
  /** 底框尺寸（含内边距）。 */
  boxWidth: number;
  boxHeight: number;
  text: FittedText;
}

export interface TitleLayout {
  text: FittedText;
  /** 各行围绕该横坐标居中。 */
  centerX: number;
  /** 第一行文字的上边界（设计坐标）。 */
  top: number;
}

export interface CoverLayout {
  width: number;
  height: number;
  title: TitleLayout;
  bubble?: BubbleLayout;
  /** 标题与气泡都能在安全区内完整显示，才允许保存。 */
  fit: boolean;
}

/**
 * 唯一的封面文字布局入口：预览与导出共用同一输出。
 * 标题、气泡的换行与缩号使用同一套几何约束与同一个文字度量器，
 * 因此预览里能放下的内容，导出时必然落在画布内。
 */
export function layoutCover(config: CoverConfig, measure: TextMeasurer): CoverLayout {
  const width = COVER_BASE_WIDTH;
  const height = config.ratio === 'portrait' ? 1200 : 900;

  // 标题：上边界固定，最高允许用到画布 42%（波形线以下由气泡使用）。
  const titleCenterX = width / 2;
  const titleTopFor = (lineHeight: number) => Math.min(height * TITLE_TOP, height * TITLE_ANCHOR_Y - lineHeight);
  const titleMaxHeight = (fontSize: number, lineHeight: number) => {
    const top = titleTopFor(lineHeight);
    return Math.max(height * 0.42 - top, lineHeight);
  };
  const titleText = fitText(
    {
      text: config.title,
      weight: TITLE_WEIGHT,
      minFontSize: TITLE_MIN,
      maxFontSize: TITLE_MAX,
      maxWidth: TITLE_MAX_WIDTH,
      maxHeight: titleMaxHeight,
      lineHeightRatio: TITLE_LINE_HEIGHT,
    },
    measure,
  );

  let bubble: BubbleLayout | undefined;
  if (config.bubbleText.length > 0) {
    const centerX = (width * config.bubbleX) / 100;
    const centerY = (height * config.bubbleY) / 100;
    // 气泡受画布四边约束（中心定位、整体旋转，留足旋转安全余量）。
    const maxHeight = Math.max(
      2 * Math.min(centerY - 24, height - centerY - 24) - BUBBLE_PAD_Y * 2,
      BUBBLE_MIN * BUBBLE_LINE_HEIGHT,
    );
    const text = fitText(
      {
        text: config.bubbleText,
        weight: BUBBLE_WEIGHT,
        minFontSize: BUBBLE_MIN,
        maxFontSize: BUBBLE_MAX,
        maxWidth: BUBBLE_MAX_WIDTH,
        maxHeight,
        lineHeightRatio: BUBBLE_LINE_HEIGHT,
      },
      measure,
    );
    bubble = {
      centerX,
      centerY,
      boxWidth: text.width + BUBBLE_PAD_X * 2,
      boxHeight: text.height + BUBBLE_PAD_Y * 2,
      text,
    };
  }

  // 横向越界同样算放不下（气泡整体旋转，宽度安全边距再收 12px）。
  const bubbleFitsHorizontally = !bubble || bubble.centerX - bubble.boxWidth / 2 >= 12 && bubble.centerX + bubble.boxWidth / 2 <= width - 12;
  const title: TitleLayout = {
    text: titleText,
    centerX: titleCenterX,
    top: titleTopFor(titleText.lineHeight),
  };
  const fit = titleText.fit && (!bubble || (bubble.text.fit && bubbleFitsHorizontally));

  return { width, height, title, bubble, fit };
}
