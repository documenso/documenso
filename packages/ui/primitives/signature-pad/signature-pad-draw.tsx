import type { MouseEvent, PointerEvent, RefObject, TouchEvent } from 'react';
import { useMemo, useRef, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { Undo2 } from 'lucide-react';
import type { StrokeOptions } from 'perfect-freehand';
import { getStroke } from 'perfect-freehand';

import { unsafe_useEffectOnce } from '@documenso/lib/client-only/hooks/use-effect-once';
import {
  SIGNATURE_CANVAS_DPI,
  SIGNATURE_MIN_COVERAGE_THRESHOLD,
} from '@documenso/lib/constants/signatures';

import { cn } from '../../lib/utils';
import { getSvgPathFromStroke } from './helper';
import { Point } from './point';
import { SignaturePadColorPicker } from './signature-pad-color-picker';

const checkSignatureValidity = (element: RefObject<HTMLCanvasElement>) => {
  if (!element.current) {
    return false;
  }

  const ctx = element.current.getContext('2d');

  if (!ctx) {
    return false;
  }

  const imageData = ctx.getImageData(0, 0, element.current.width, element.current.height);
  const data = imageData.data;
  let filledPixels = 0;
  const totalPixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) filledPixels++;
  }

  const filledPercentage = filledPixels / totalPixels;
  const isValid = filledPercentage > SIGNATURE_MIN_COVERAGE_THRESHOLD;

  return isValid;
};

export type SignaturePadDrawProps = {
  className?: string;
  value: string;
  onChange: (_signatureDataUrl: string) => void;
};

export const SignaturePadDraw = ({
  className,
  value,
  onChange,
  ...props
}: SignaturePadDrawProps) => {
  const $el = useRef<HTMLCanvasElement>(null);

  const $imageData = useRef<ImageData | null>(null);
  const $fileInput = useRef<HTMLInputElement>(null);

  const [isPressed, setIsPressed] = useState(false);
  const [lines, setLines] = useState<Point[][]>([]);
  const [currentLine, setCurrentLine] = useState<Point[]>([]);
  const [isSignatureValid, setIsSignatureValid] = useState<boolean | null>(null);

  const [selectedColor, setSelectedColor] = useState('black');

  const perfectFreehandOptions = useMemo(() => {
    const size = $el.current ? Math.min($el.current.height, $el.current.width) * 0.03 : 10;

    return {
      size,
      thinning: 0.25,
      streamline: 0.5,
      smoothing: 0.5,
      end: {
        taper: size * 2,
      },
    } satisfies StrokeOptions;
  }, []);

  const onMouseDown = (event: MouseEvent | PointerEvent | TouchEvent) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    setIsPressed(true);

    const point = Point.fromEvent(event, SIGNATURE_CANVAS_DPI, $el.current);

    setCurrentLine([point]);
  };

  const onMouseMove = (event: MouseEvent | PointerEvent | TouchEvent) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    if (!isPressed) {
      return;
    }

    const point = Point.fromEvent(event, SIGNATURE_CANVAS_DPI, $el.current);
    const lastPoint = currentLine[currentLine.length - 1];

    if (lastPoint && point.distanceTo(lastPoint) > 5) {
      setCurrentLine([...currentLine, point]);

      // Update the canvas here to draw the lines
      if ($el.current) {
        const ctx = $el.current.getContext('2d');

        if (ctx) {
          ctx.restore();
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.fillStyle = selectedColor;

          lines.forEach((line) => {
            const pathData = new Path2D(
              getSvgPathFromStroke(getStroke(line, perfectFreehandOptions)),
            );

            ctx.fill(pathData);
          });

          const pathData = new Path2D(
            getSvgPathFromStroke(getStroke([...currentLine, point], perfectFreehandOptions)),
          );
          ctx.fill(pathData);
        }
      }
    }
  };

  const onMouseUp = (event: MouseEvent | PointerEvent | TouchEvent, addLine = true) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    setIsPressed(false);

    const point = Point.fromEvent(event, SIGNATURE_CANVAS_DPI, $el.current);

    const newLines = [...lines];

    if (addLine && currentLine.length > 0) {
      newLines.push([...currentLine, point]);
      setCurrentLine([]);
    }

    setLines(newLines);

    if ($el.current && newLines.length > 0) {
      const ctx = $el.current.getContext('2d');

      if (ctx) {
        ctx.restore();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = selectedColor;

        newLines.forEach((line) => {
          const pathData = new Path2D(
            getSvgPathFromStroke(getStroke(line, perfectFreehandOptions)),
          );
          ctx.fill(pathData);
        });

        const isValidSignature = checkSignatureValidity($el);

        setIsSignatureValid(isValidSignature);

        if (isValidSignature) {
          onChange?.($el.current.toDataURL());
        }
        ctx.save();
      }
    }
  };

  const onMouseEnter = (event: MouseEvent | PointerEvent | TouchEvent) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    if ('buttons' in event && event.buttons === 1) {
      onMouseDown(event);
    }
  };

  const onMouseLeave = (event: MouseEvent | PointerEvent | TouchEvent) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    if (isPressed) {
      onMouseUp(event, true);
    } else {
      onMouseUp(event, false);
    }
  };

  const onClearClick = () => {
    if ($el.current) {
      const ctx = $el.current.getContext('2d');

      ctx?.clearRect(0, 0, $el.current.width, $el.current.height);
      $imageData.current = null;
    }

    if ($fileInput.current) {
      $fileInput.current.value = '';
    }

    onChange('');

    setLines([]);
    setCurrentLine([]);
    setIsPressed(false);
  };

  const onUndoClick = () => {
    if (lines.length === 0 || !$el.current) {
      return;
    }

    const newLines = lines.slice(0, -1);
    setLines(newLines);

    // Clear and redraw the canvas
    const ctx = $el.current.getContext('2d');
    const { width, height } = $el.current;
    ctx?.clearRect(0, 0, width, height);

    if ($imageData.current) {
      ctx?.putImageData($imageData.current, 0, 0);
    }

    newLines.forEach((line) => {
      const pathData = new Path2D(getSvgPathFromStroke(getStroke(line, perfectFreehandOptions)));
      ctx?.fill(pathData);
    });

    onChange?.($el.current.toDataURL());
  };

  unsafe_useEffectOnce(() => {
    if ($el.current) {
      $el.current.width = $el.current.clientWidth * SIGNATURE_CANVAS_DPI;
      $el.current.height = $el.current.clientHeight * SIGNATURE_CANVAS_DPI;
    }

    if ($el.current && value) {
      const ctx = $el.current.getContext('2d');

      const { width, height } = $el.current;

      const img = new Image();

      img.onload = () => {
        ctx?.drawImage(img, 0, 0, Math.min(width, img.width), Math.min(height, img.height));

        const defaultImageData = ctx?.getImageData(0, 0, width, height) || null;

        $imageData.current = defaultImageData;
      };

      img.src = value;
    }
  });

  return (
    <div className={cn('h-full w-full', className)}>
      <canvas
        data-testid="signature-pad-draw"
        ref={$el}
        className={cn('h-full w-full', {
          'dark:hue-rotate-180 dark:invert': selectedColor === 'black',
        })}
        style={{ touchAction: 'none' }}
        onPointerMove={(event) => onMouseMove(event)}
        onPointerDown={(event) => onMouseDown(event)}
        onPointerUp={(event) => onMouseUp(event)}
        onPointerLeave={(event) => onMouseLeave(event)}
        onPointerEnter={(event) => onMouseEnter(event)}
        {...props}
      />

      <SignaturePadColorPicker selectedColor={selectedColor} setSelectedColor={setSelectedColor} />

      <div className="absolute bottom-3 right-3 flex gap-2">
        <button
          type="button"
          className="focus-visible:ring-ring ring-offset-background text-muted-foreground/60 hover:text-muted-foreground rounded-full p-0 text-[0.688rem] focus-visible:outline-none focus-visible:ring-2"
          onClick={() => onClearClick()}
        >
          <Trans>Clear Signature</Trans>
        </button>
      </div>

      {isSignatureValid === false && (
        <div className="absolute bottom-4 left-4 flex gap-2">
          <span className="text-destructive text-xs">
            <Trans>Signature is too small</Trans>
          </span>
        </div>
      )}

      {isSignatureValid && lines.length > 0 && (
        <div className="absolute bottom-4 left-4 flex gap-2">
          <button
            type="button"
            title="undo"
            className="focus-visible:ring-ring ring-offset-background text-muted-foreground/60 hover:text-muted-foreground rounded-full p-0 text-[0.688rem] focus-visible:outline-none focus-visible:ring-2"
            onClick={onUndoClick}
          >
            <Undo2 className="h-4 w-4" />
            <span className="sr-only">Undo</span>
          </button>
        </div>
      )}
    </div>
  );
};
