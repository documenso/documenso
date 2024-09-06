'use client';

import type { HTMLAttributes, MouseEvent, PointerEvent, TouchEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Trans } from '@lingui/macro';
import { Undo2 } from 'lucide-react';
import type { StrokeOptions } from 'perfect-freehand';
import { getStroke } from 'perfect-freehand';

import { unsafe_useEffectOnce } from '@documenso/lib/client-only/hooks/use-effect-once';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

import { cn } from '../../lib/utils';
import { getSvgPathFromStroke } from './helper';
import { Point } from './point';

const DPI = 2;

export type SignaturePadProps = Omit<HTMLAttributes<HTMLCanvasElement>, 'onChange'> & {
  onChange?: (_signatureDataUrl: string | null) => void;
  containerClassName?: string;
  disabled?: boolean;
};

export const SignaturePad = ({
  className,
  containerClassName,
  defaultValue,
  onChange,
  disabled = false,
  ...props
}: SignaturePadProps) => {
  const $el = useRef<HTMLCanvasElement>(null);
  const $imageData = useRef<ImageData | null>(null);

  const [isPressed, setIsPressed] = useState(false);
  const [lines, setLines] = useState<Point[][]>([]);
  const [currentLine, setCurrentLine] = useState<Point[]>([]);
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

    const point = Point.fromEvent(event, DPI, $el.current);

    setCurrentLine([point]);
  };

  const onMouseMove = (event: MouseEvent | PointerEvent | TouchEvent) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    if (!isPressed) {
      return;
    }

    const point = Point.fromEvent(event, DPI, $el.current);

    if (point.distanceTo(currentLine[currentLine.length - 1]) > 5) {
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

    const point = Point.fromEvent(event, DPI, $el.current);

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

        onChange?.($el.current.toDataURL());
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

    onMouseUp(event, false);
  };

  const onClearClick = () => {
    if ($el.current) {
      const ctx = $el.current.getContext('2d');

      ctx?.clearRect(0, 0, $el.current.width, $el.current.height);
      $imageData.current = null;
    }

    onChange?.(null);

    setLines([]);
    setCurrentLine([]);
  };

  const onUndoClick = () => {
    if (lines.length === 0) {
      return;
    }

    const newLines = lines.slice(0, -1);
    setLines(newLines);

    // Clear the canvas
    if ($el.current) {
      const ctx = $el.current.getContext('2d');
      const { width, height } = $el.current;
      ctx?.clearRect(0, 0, width, height);

      if (typeof defaultValue === 'string' && $imageData.current) {
        ctx?.putImageData($imageData.current, 0, 0);
      }

      newLines.forEach((line) => {
        const pathData = new Path2D(getSvgPathFromStroke(getStroke(line, perfectFreehandOptions)));
        ctx?.fill(pathData);
      });

      onChange?.($el.current.toDataURL());
    }
  };

  useEffect(() => {
    if ($el.current) {
      $el.current.width = $el.current.clientWidth * DPI;
      $el.current.height = $el.current.clientHeight * DPI;
    }
  }, []);

  unsafe_useEffectOnce(() => {
    if ($el.current && typeof defaultValue === 'string') {
      const ctx = $el.current.getContext('2d');

      const { width, height } = $el.current;

      const img = new Image();

      img.onload = () => {
        ctx?.drawImage(img, 0, 0, Math.min(width, img.width), Math.min(height, img.height));

        const defaultImageData = ctx?.getImageData(0, 0, width, height) || null;

        $imageData.current = defaultImageData;
      };

      img.src = defaultValue;
    }
  });

  return (
    <div
      className={cn('relative block', containerClassName, {
        'pointer-events-none opacity-50': disabled,
      })}
    >
      <canvas
        ref={$el}
        className={cn(
          'relative block',
          {
            'dark:hue-rotate-180 dark:invert': selectedColor === 'black',
          },
          className,
        )}
        style={{ touchAction: 'none' }}
        onPointerMove={(event) => onMouseMove(event)}
        onPointerDown={(event) => onMouseDown(event)}
        onPointerUp={(event) => onMouseUp(event)}
        onPointerLeave={(event) => onMouseLeave(event)}
        onPointerEnter={(event) => onMouseEnter(event)}
        {...props}
      />

      <div className="text-foreground absolute right-2 top-2 filter">
        <Select defaultValue={selectedColor} onValueChange={(value) => setSelectedColor(value)}>
          <SelectTrigger className="h-auto w-auto border-none p-1">
            <SelectValue placeholder="" />
          </SelectTrigger>

          <SelectContent className="w-[150px]" align="end">
            <SelectItem value="black">
              <div className="text-muted-foreground flex items-center px-1 text-sm">
                <div className="border-border mr-2 h-5 w-5 rounded-full border-2 bg-black shadow-sm" />
                <Trans>Black</Trans>
              </div>
            </SelectItem>

            <SelectItem value="red">
              <div className="text-muted-foreground flex items-center px-1 text-sm">
                <div className="border-border mr-2 h-5 w-5 rounded-full border-2 bg-[red] shadow-sm" />
                <Trans>Red</Trans>
              </div>
            </SelectItem>

            <SelectItem value="blue">
              <div className="text-muted-foreground flex items-center px-1 text-sm">
                <div className="border-border mr-2 h-5 w-5 rounded-full border-2 bg-[blue] shadow-sm" />
                <Trans>Blue</Trans>
              </div>
            </SelectItem>

            <SelectItem value="green">
              <div className="text-muted-foreground flex items-center px-1 text-sm">
                <div className="border-border mr-2 h-5 w-5 rounded-full border-2 bg-[green] shadow-sm" />
                <Trans>Green</Trans>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          type="button"
          className="focus-visible:ring-ring ring-offset-background text-muted-foreground/60 hover:text-muted-foreground rounded-full p-0 text-xs focus-visible:outline-none focus-visible:ring-2"
          onClick={() => onClearClick()}
        >
          <Trans>Clear Signature</Trans>
        </button>
      </div>

      {lines.length > 0 && (
        <div className="absolute bottom-4 left-4 flex gap-2">
          <button
            type="button"
            title="undo"
            className="focus-visible:ring-ring ring-offset-background text-muted-foreground/60 hover:text-muted-foreground rounded-full p-0 text-xs focus-visible:outline-none focus-visible:ring-2"
            onClick={() => onUndoClick()}
          >
            <Undo2 className="h-4 w-4" />
            <span className="sr-only">Undo</span>
          </button>
        </div>
      )}
    </div>
  );
};
