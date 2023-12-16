/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { RefObject, useEffect, useState } from 'react';

/**
 * Calculate the width and height of a text element.
 *
 * @param text The text to calculate the width and height of.
 * @param fontSize The font size to apply to the text.
 * @param fontFamily The font family to apply to the text.
 * @returns Returns the width and height of the text.
 */
function calculateTextDimensions(
  text: string,
  fontSize: string,
  fontFamily: string,
): { width: number; height: number } {
  // Reuse old canvas if available.
  let canvas = (calculateTextDimensions as { canvas?: HTMLCanvasElement }).canvas;

  if (!canvas) {
    canvas = document.createElement('canvas');
    (calculateTextDimensions as { canvas?: HTMLCanvasElement }).canvas = canvas;
  }

  const context = canvas.getContext('2d');
  if (!context) {
    return { width: 0, height: 0 };
  }

  context.font = `${fontSize} ${fontFamily}`;
  const metrics = context.measureText(text);

  return {
    width: metrics.width,
    height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
  };
}

/**
 * Calculate the scaling size to apply to a text to fit it within a container.
 *
 * @param container The container dimensions to fit the text within.
 * @param text The text to fit within the container.
 * @param fontSize The font size to apply to the text.
 * @param fontFamily The font family to apply to the text.
 * @returns Returns a value between 0 and 1 which represents the scaling factor to apply to the text.
 */
export const calculateTextScaleSize = (
  container: { width: number; height: number },
  text: string,
  fontSize: string,
  fontFamily: string,
) => {
  const { width, height } = calculateTextDimensions(text, fontSize, fontFamily);
  return Math.min(container.width / width, container.height / height, 1);
};

/**
 * Given a container and child element, calculate the scaling size to apply to the child.
 */
export function useElementScaleSize(
  container: { width: number; height: number },
  text: string,
  fontSize: number,
  fontFamily: string,
) {
  const [scalingFactor, setScalingFactor] = useState(1);

  useEffect(() => {
    const scaleSize = calculateTextScaleSize(container, text, `${fontSize}px`, fontFamily);

    setScalingFactor(scaleSize);
  }, [text, container, fontFamily, fontSize]);

  return scalingFactor;
}
