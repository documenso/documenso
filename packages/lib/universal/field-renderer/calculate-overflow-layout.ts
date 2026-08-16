import Konva from 'konva';

import type { TFieldOverflowMode } from '../../types/field-meta';

type OverflowLayoutParams = {
  /** The resolved overflow mode ('crop' | 'auto' | 'horizontal' | 'vertical'). */
  overflowMode: TFieldOverflowMode;

  /** True when rendering the field type name (like "Text", "Date", "Email") or a user label, not actual user content. */
  isLabel: boolean;

  /** The text content to render. Used to determine if text overflows the field bounds. */
  textToRender: string;

  /** Font size in pixels. */
  fontSize: number;

  /** CSS font family string. */
  fontFamily: string;

  /** Line height multiplier. */
  lineHeight: number;

  /** Letter spacing in pixels. */
  letterSpacing: number;

  /** Horizontal text alignment. */
  textAlign: 'left' | 'center' | 'right';

  /** Vertical text alignment. */
  verticalAlign: 'top' | 'middle' | 'bottom';

  /** Text x position within the group (e.g. padding offset). */
  baseX: number;

  /** Text y position within the group. */
  baseY: number;

  /** Text width at field bounds (fieldWidth minus any padding). */
  baseWidth: number;

  /** Text height at field bounds (fieldHeight). */
  baseHeight: number;

  /** Group x position on the page (fieldX from calculateFieldPosition). */
  groupX: number;

  /** Group y position on the page (fieldY from calculateFieldPosition). */
  groupY: number;

  /** Full page width in pixels. */
  pageWidth: number;

  /** Full page height in pixels. */
  pageHeight: number;
};

type OverflowLayoutResult = {
  x: number;
  y: number;
  width: number;
  height: number;
  wrap: 'word' | 'none';
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
};

/**
 * Calculate layout metrics for the text within the field.
 *
 * Returns:
 * - exceedsWidth: whether the unwrapped text exceeds the field width
 * - exceedsHeightWhenWrapped: whether wrapping the text at field width exceeds the field height
 * - hasRoomForMoreThanOneLine: whether the field can fit 2+ lines of text
 */
const calculateLayout = (params: {
  textToRender: string;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  letterSpacing: number;
  baseWidth: number;
  baseHeight: number;
}): {
  exceedsWidth: boolean;
  exceedsHeightWhenWrapped: boolean;
  hasRoomForMoreThanOneLine: boolean;
} => {
  const { textToRender, fontSize, fontFamily, lineHeight, letterSpacing, baseWidth, baseHeight } = params;

  // Measure the text without width constraint to get natural width and single-line height.
  const unwrappedNode = new Konva.Text({
    text: textToRender,
    fontSize,
    fontFamily,
    lineHeight,
    letterSpacing,
  });

  const exceedsWidth = unwrappedNode.width() > baseWidth;
  const oneLineHeight = unwrappedNode.height();

  unwrappedNode.destroy();

  const hasRoomForMoreThanOneLine = baseHeight >= oneLineHeight * 2;

  // Measure the text wrapped at field width to check vertical overflow.
  const wrappedNode = new Konva.Text({
    text: textToRender,
    fontSize,
    fontFamily,
    lineHeight,
    letterSpacing,
    width: baseWidth,
    wrap: 'word',
  });

  const exceedsHeightWhenWrapped = wrappedNode.height() > baseHeight;

  wrappedNode.destroy();

  return { exceedsWidth, exceedsHeightWhenWrapped, hasRoomForMoreThanOneLine };
};

/**
 * Calculate horizontal overflow layout based on text alignment.
 *
 * The text node is expanded beyond the field bounds toward the page edges.
 * - left-aligned: extends rightward to page right edge
 * - right-aligned: extends leftward to page left edge
 * - center-aligned: extends symmetrically toward the closer page edge
 */
const calculateHorizontalOverflow = (params: OverflowLayoutParams): OverflowLayoutResult => {
  const { textAlign, baseX, baseY, baseWidth, baseHeight, groupX, pageWidth } = params;

  if (textAlign === 'right') {
    // Extend leftward to page left edge.
    // Right edge of text stays at (baseX + baseWidth) within the group.
    const newX = -groupX;
    const newWidth = groupX + baseX + baseWidth;

    return {
      x: newX,
      y: baseY,
      width: newWidth,
      height: baseHeight,
      wrap: 'none',
      textAlign,
      verticalAlign: params.verticalAlign,
    };
  }

  if (textAlign === 'center') {
    // Extend symmetrically from the text center toward the closer page edge.
    const leftSpace = groupX + baseX;
    const rightSpace = pageWidth - (groupX + baseX + baseWidth);
    const maxExtend = Math.min(leftSpace, rightSpace);

    const newX = baseX - maxExtend;
    const newWidth = baseWidth + maxExtend * 2;

    return {
      x: newX,
      y: baseY,
      width: newWidth,
      height: baseHeight,
      wrap: 'none',
      textAlign,
      verticalAlign: params.verticalAlign,
    };
  }

  // Default: left-aligned — extend rightward to page right edge.
  const newWidth = pageWidth - groupX - baseX;

  return {
    x: baseX,
    y: baseY,
    width: newWidth,
    height: baseHeight,
    wrap: 'none',
    textAlign,
    verticalAlign: params.verticalAlign,
  };
};

/**
 * Calculate vertical overflow layout based on vertical alignment.
 *
 * The text node keeps the field width (text wraps) and expands height toward the page edges.
 * - top aligned: extends downward to page bottom
 * - bottom aligned: extends upward to page top
 * - middle aligned: extends symmetrically up and down toward the closer page edge
 */
const calculateVerticalOverflow = (params: OverflowLayoutParams): OverflowLayoutResult => {
  const { verticalAlign, textAlign, baseX, baseY, baseWidth, baseHeight, groupY, pageHeight } = params;

  if (verticalAlign === 'bottom') {
    // Extend upward to page top edge.
    // Bottom edge of text stays at (baseY + baseHeight) within the group.
    const newY = -groupY;
    const newHeight = groupY + baseY + baseHeight;

    return {
      x: baseX,
      y: newY,
      width: baseWidth,
      height: newHeight,
      wrap: 'word',
      textAlign,
      verticalAlign: 'bottom',
    };
  }

  if (verticalAlign === 'middle') {
    // Extend both up and down from the field center.
    // Text stays vertically centered at the original field position.
    const upSpace = groupY + baseY;
    const downSpace = pageHeight - (groupY + baseY + baseHeight);
    const maxExtend = Math.min(upSpace, downSpace);

    const newY = baseY - maxExtend;
    const newHeight = baseHeight + maxExtend * 2;

    return {
      x: baseX,
      y: newY,
      width: baseWidth,
      height: newHeight,
      wrap: 'word',
      textAlign,
      verticalAlign: 'middle',
    };
  }

  // Default: top — extend downward to page bottom edge.
  const newHeight = pageHeight - groupY - baseY;

  return {
    x: baseX,
    y: baseY,
    width: baseWidth,
    height: newHeight,
    wrap: 'word',
    textAlign,
    verticalAlign: 'top',
  };
};

/**
 * Calculate overflow-aware text layout dimensions.
 *
 * Returns { x, y, width, height, wrap } to spread into a Konva.Text setAttrs() call.
 *
 * For 'crop' mode or placeholder content, returns the original field bounds (current behavior).
 * For 'horizontal'/'vertical'/'auto', expands the text node dimensions toward the page edges
 * based on text alignment and field position.
 */
export const calculateOverflowLayout = (params: OverflowLayoutParams): OverflowLayoutResult => {
  const { overflowMode, isLabel, baseX, baseY, baseWidth, baseHeight } = params;

  // No overflow for placeholders or crop mode — return original field bounds.
  if (isLabel || overflowMode === 'crop') {
    return {
      x: baseX,
      y: baseY,
      width: baseWidth,
      height: baseHeight,
      wrap: 'word',
      textAlign: params.textAlign,
      verticalAlign: params.verticalAlign,
    };
  }

  if (overflowMode === 'horizontal') {
    return calculateHorizontalOverflow(params);
  }

  if (overflowMode === 'vertical') {
    return calculateVerticalOverflow(params);
  }

  // Auto mode: measure the text and field to decide overflow direction.
  const layout = calculateLayout({
    textToRender: params.textToRender,
    fontSize: params.fontSize,
    fontFamily: params.fontFamily,
    lineHeight: params.lineHeight,
    letterSpacing: params.letterSpacing,
    baseWidth,
    baseHeight,
  });

  // Auto single-line: overflow horizontal only when text exceeds field width.
  // Center text align is overridden to left so it overflows right.
  if (!layout.hasRoomForMoreThanOneLine) {
    if (!layout.exceedsWidth) {
      // Text fits — keep original alignment, no overflow needed.
      return {
        x: baseX,
        y: baseY,
        width: baseWidth,
        height: baseHeight,
        wrap: 'none',
        textAlign: params.textAlign,
        verticalAlign: params.verticalAlign,
      };
    }

    return calculateHorizontalOverflow({
      ...params,
      textAlign: params.textAlign === 'center' ? 'left' : params.textAlign,
    });
  }

  // Auto multi-line: overflow vertical only when wrapped text exceeds field height.
  // Middle vertical align is only overridden to top if the text actually overflows vertically.
  // If it fits, keep middle so the text stays centered within the field.
  if (!layout.exceedsHeightWhenWrapped) {
    // Text fits when wrapped — keep original alignment, no overflow needed.
    return {
      x: baseX,
      y: baseY,
      width: baseWidth,
      height: baseHeight,
      wrap: 'word',
      textAlign: params.textAlign,
      verticalAlign: params.verticalAlign,
    };
  }

  const verticalAlignOverride = params.verticalAlign === 'middle' ? 'top' : params.verticalAlign;

  return calculateVerticalOverflow({
    ...params,
    verticalAlign: verticalAlignOverride,
  });
};
