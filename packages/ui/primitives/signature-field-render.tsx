import { SIGNATURE_CANVAS_DPI } from '@documenso/lib/constants/signatures';
import { useEffect, useRef } from 'react';

import { cn } from '../lib/utils';
import { trimTransparentCanvasMargins } from './signature-pad/signature-image-utils';

export type SignatureFieldRenderProps = {
  className?: string;
  value: string;
  textAlign?: 'left' | 'center' | 'right';
};

export const SignatureFieldRender = ({ className, value, textAlign = 'center' }: SignatureFieldRenderProps) => {
  const $el = useRef<HTMLCanvasElement>(null);

  const drawCanvasWithContain = (sourceCanvas: HTMLCanvasElement) => {
    if (!$el.current) {
      return;
    }

    const ctx = $el.current.getContext('2d');

    if (!ctx) {
      return;
    }

    const { width, height } = $el.current;
    const scale = Math.min(width / sourceCanvas.width, height / sourceCanvas.height);
    const scaledWidth = sourceCanvas.width * scale;
    const scaledHeight = sourceCanvas.height * scale;

    const x = textAlign === 'left' ? 0 : textAlign === 'right' ? width - scaledWidth : (width - scaledWidth) / 2;

    const y = (height - scaledHeight) / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(sourceCanvas, x, y, scaledWidth, scaledHeight);
  };

  useEffect(() => {
    if ($el.current) {
      $el.current.width = $el.current.clientWidth * SIGNATURE_CANVAS_DPI;
      $el.current.height = $el.current.clientHeight * SIGNATURE_CANVAS_DPI;
    }
  }, []);

  useEffect(() => {
    if (!$el.current) {
      return;
    }

    const ctx = $el.current.getContext('2d');

    if (!ctx) {
      return;
    }

    const canvasWidth = $el.current.width;
    const canvasHeight = $el.current.height;
    const fontFamily = 'Caveat';

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = canvasWidth;
    sourceCanvas.height = canvasHeight;

    const sourceCtx = sourceCanvas.getContext('2d');

    if (!sourceCtx) {
      return;
    }

    sourceCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    sourceCtx.textAlign = 'center';
    sourceCtx.textBaseline = 'middle';
    sourceCtx.fillStyle = 'currentColor';

    const desiredWidth = canvasWidth * 0.98;
    const desiredHeight = canvasHeight * 0.92;

    let fontSize = 18;
    sourceCtx.font = `${fontSize}px ${fontFamily}`;

    const measureTextBounds = () => {
      const metrics = sourceCtx.measureText(value);
      const measuredWidth = metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft || metrics.width || 1;
      const measuredHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || fontSize;

      return {
        width: measuredWidth,
        height: measuredHeight,
      };
    };

    for (let i = 0; i < 2; i += 1) {
      const bounds = measureTextBounds();
      const scale = Math.min(desiredWidth / bounds.width, desiredHeight / bounds.height);
      fontSize *= scale;
      sourceCtx.font = `${fontSize}px ${fontFamily}`;
    }

    sourceCtx.fillText(value, canvasWidth / 2, canvasHeight / 2);

    const trimmedCanvas = trimTransparentCanvasMargins(sourceCanvas);
    drawCanvasWithContain(trimmedCanvas);
  }, [textAlign, value]);

  return <canvas ref={$el} className={cn('h-full w-full dark:hue-rotate-180 dark:invert', className)} />;
};
