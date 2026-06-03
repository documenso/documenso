// ABOUTME: Utility to compute the largest integer font size at which a text string fits within given dimensions.
// ABOUTME: Accepts an optional measurer function so callers can inject Konva.Text measurement or a test double.

/**
 * Function signature for a text height measurer.
 * Returns the rendered height of `text` at the given `fontSize` and constrained to `width`.
 */
export type TextMeasurer = (
  text: string,
  fontFamily: string,
  fontSize: number,
  width: number,
) => number;

/**
 * Default measurer using Konva.Text. Only usable in browser or Node.js with a canvas backend.
 * Lazily resolved so this module is importable in Node.js environments that mock Konva.
 */
const konvaMeasurer: TextMeasurer = (text, fontFamily, fontSize, width) => {
  // Dynamic import is not feasible in a sync call; use require-style import.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const konvaModule: { default: typeof import('konva').default } = require('konva');
  const Konva = konvaModule.default;

  const probe = new Konva.Text({
    text,
    fontFamily,
    fontSize,
    width,
    wrap: 'char',
  });

  return probe.height();
};

/**
 * Returns the largest integer font size in [minFontSize, maxFontSize] such that the rendered
 * height of `text` (with `fontFamily`, constrained to `maxWidth`) does not exceed `maxHeight`.
 *
 * Falls back to `minFontSize` when the text overflows at every candidate size.
 *
 * @param text        The string to measure.
 * @param fontFamily  CSS font-family string (e.g. "Caveat, sans-serif").
 * @param maxWidth    Available width in pixels.
 * @param maxHeight   Available height in pixels.
 * @param maxFontSize Largest font size to try.
 * @param minFontSize Smallest font size to accept.
 * @param measurer    Optional measurer; defaults to Konva.Text measurement.
 */
export const fitFontSize = (
  text: string,
  fontFamily: string,
  maxWidth: number,
  maxHeight: number,
  maxFontSize: number,
  minFontSize: number,
  measurer: TextMeasurer = konvaMeasurer,
): number => {
  // Clamp so callers cannot accidentally invert the range.
  const lo = Math.max(1, minFontSize);
  const hi = Math.max(lo, maxFontSize);

  // Binary search for the largest fitting size.
  let low = lo;
  let high = hi;
  let best = lo;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const renderedHeight = measurer(text, fontFamily, mid, maxWidth);

    if (renderedHeight <= maxHeight) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
};
