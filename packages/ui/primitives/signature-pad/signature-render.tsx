import { isBase64Image, SIGNATURE_CANVAS_DPI } from '@documenso/lib/constants/signatures';
import { useEffect, useRef } from 'react';

import { cn } from '../../lib/utils';
import { trimTransparentCanvasMargins } from './signature-image-utils';

export type SignatureRenderProps = {
  className?: string;
  value: string;
};

/**
 * Renders a typed, uploaded or drawn signature.
 */
export const SignatureRender = ({ className, value }: SignatureRenderProps) => {
  const $el = useRef<HTMLCanvasElement>(null);
  const $imageData = useRef<ImageData | null>(null);

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
    const x = (width - scaledWidth) / 2;
    const y = (height - scaledHeight) / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(sourceCanvas, x, y, scaledWidth, scaledHeight);
  };

  const drawCanvasWithCover = (sourceCanvas: HTMLCanvasElement) => {
    if (!$el.current) {
      return;
    }

    const ctx = $el.current.getContext('2d');

    if (!ctx) {
      return;
    }

    const { width, height } = $el.current;
    const scale = Math.max(width / sourceCanvas.width, height / sourceCanvas.height);
    const scaledWidth = sourceCanvas.width * scale;
    const scaledHeight = sourceCanvas.height * scale;
    const x = (width - scaledWidth) / 2;
    const y = (height - scaledHeight) / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(sourceCanvas, x, y, scaledWidth, scaledHeight);
  };

  const renderTypedSignature = () => {
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

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // ctx.fillStyle = selectedColor; // Todo: Color not implemented...

    // Calculate the desired width (25ch)
    const desiredWidth = canvasWidth * 0.85; // 85% of canvas width

    // Start with a base font size
    let fontSize = 18;
    ctx.font = `${fontSize}px ${fontFamily}`;

    // Measure 10 characters and calculate scale factor
    const characterWidth = ctx.measureText('m'.repeat(10)).width;
    const scaleFactor = desiredWidth / characterWidth;

    // Apply scale factor to font size
    fontSize = fontSize * scaleFactor;

    // Adjust font size if it exceeds canvas width
    ctx.font = `${fontSize}px ${fontFamily}`;

    const textWidth = ctx.measureText(value).width;

    if (textWidth > desiredWidth) {
      fontSize = fontSize * (desiredWidth / textWidth);
    }

    // Set final font and render text
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillText(value, canvasWidth / 2, canvasHeight / 2);

    const trimmedCanvas = trimTransparentCanvasMargins($el.current);
    drawCanvasWithCover(trimmedCanvas);
  };

  const renderImageSignature = () => {
    if (!$el.current || typeof value !== 'string') {
      return;
    }

    const { width, height } = $el.current;

    const img = new Image();

    img.onload = () => {
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;

      const offscreenCtx = offscreenCanvas.getContext('2d');

      if (!offscreenCtx) {
        return;
      }

      const scale = Math.min(width / img.width, height / img.height);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      const x = (width - scaledWidth) / 2;
      const y = (height - scaledHeight) / 2;

      offscreenCtx.clearRect(0, 0, width, height);
      offscreenCtx.drawImage(img, x, y, scaledWidth, scaledHeight);

      const trimmedCanvas = trimTransparentCanvasMargins(offscreenCanvas);
      drawCanvasWithContain(trimmedCanvas);
      $imageData.current = $el.current?.getContext('2d')?.getImageData(0, 0, width, height) || null;
    };

    img.src = value;
  };

  useEffect(() => {
    if ($el.current) {
      $el.current.width = $el.current.clientWidth * SIGNATURE_CANVAS_DPI;
      $el.current.height = $el.current.clientHeight * SIGNATURE_CANVAS_DPI;
    }
  }, []);

  useEffect(() => {
    if (isBase64Image(value)) {
      renderImageSignature();
    } else {
      renderTypedSignature();
    }
  }, [value]);

  return (
    <canvas
      ref={$el}
      className={cn('h-full w-full dark:hue-rotate-180 dark:invert', className)}
      style={{ touchAction: 'none' }}
    />
  );
};
