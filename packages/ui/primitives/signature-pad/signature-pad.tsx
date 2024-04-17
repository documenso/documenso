'use client';

<<<<<<< HEAD
import {
  HTMLAttributes,
  MouseEvent,
  PointerEvent,
  TouchEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { StrokeOptions, getStroke } from 'perfect-freehand';

import { cn } from '@documenso/ui/lib/utils';

=======
import type { HTMLAttributes, MouseEvent, PointerEvent, TouchEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Undo2 } from 'lucide-react';
import type { StrokeOptions } from 'perfect-freehand';
import { getStroke } from 'perfect-freehand';

import { unsafe_useEffectOnce } from '@documenso/lib/client-only/hooks/use-effect-once';

import { cn } from '../../lib/utils';
>>>>>>> main
import { getSvgPathFromStroke } from './helper';
import { Point } from './point';

const DPI = 2;

export type SignaturePadProps = Omit<HTMLAttributes<HTMLCanvasElement>, 'onChange'> & {
  onChange?: (_signatureDataUrl: string | null) => void;
  containerClassName?: string;
<<<<<<< HEAD
=======
  disabled?: boolean;
>>>>>>> main
};

export const SignaturePad = ({
  className,
  containerClassName,
  defaultValue,
  onChange,
<<<<<<< HEAD
  ...props
}: SignaturePadProps) => {
  const $el = useRef<HTMLCanvasElement>(null);

  const [isPressed, setIsPressed] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
=======
  disabled = false,
  ...props
}: SignaturePadProps) => {
  const $el = useRef<HTMLCanvasElement>(null);
  const $imageData = useRef<ImageData | null>(null);

  const [isPressed, setIsPressed] = useState(false);
  const [lines, setLines] = useState<Point[][]>([]);
  const [currentLine, setCurrentLine] = useState<Point[]>([]);
>>>>>>> main

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

<<<<<<< HEAD
    const newPoints = [...points, point];

    setPoints(newPoints);

    if ($el.current) {
      const ctx = $el.current.getContext('2d');

      if (ctx) {
        ctx.save();

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const pathData = new Path2D(
          getSvgPathFromStroke(getStroke(newPoints, perfectFreehandOptions)),
        );

        ctx.fill(pathData);
      }
    }
=======
    setCurrentLine([point]);
>>>>>>> main
  };

  const onMouseMove = (event: MouseEvent | PointerEvent | TouchEvent) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    if (!isPressed) {
      return;
    }

    const point = Point.fromEvent(event, DPI, $el.current);

<<<<<<< HEAD
    if (point.distanceTo(points[points.length - 1]) > 5) {
      const newPoints = [...points, point];

      setPoints(newPoints);

=======
    if (point.distanceTo(currentLine[currentLine.length - 1]) > 5) {
      setCurrentLine([...currentLine, point]);

      // Update the canvas here to draw the lines
>>>>>>> main
      if ($el.current) {
        const ctx = $el.current.getContext('2d');

        if (ctx) {
          ctx.restore();
<<<<<<< HEAD

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          const pathData = new Path2D(
            getSvgPathFromStroke(getStroke(points, perfectFreehandOptions)),
          );

=======
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          lines.forEach((line) => {
            const pathData = new Path2D(
              getSvgPathFromStroke(getStroke(line, perfectFreehandOptions)),
            );

            ctx.fill(pathData);
          });

          const pathData = new Path2D(
            getSvgPathFromStroke(getStroke([...currentLine, point], perfectFreehandOptions)),
          );
>>>>>>> main
          ctx.fill(pathData);
        }
      }
    }
  };

<<<<<<< HEAD
  const onMouseUp = (event: MouseEvent | PointerEvent | TouchEvent, addPoint = true) => {
=======
  const onMouseUp = (event: MouseEvent | PointerEvent | TouchEvent, addLine = true) => {
>>>>>>> main
    if (event.cancelable) {
      event.preventDefault();
    }

    setIsPressed(false);

    const point = Point.fromEvent(event, DPI, $el.current);

<<<<<<< HEAD
    const newPoints = [...points];

    if (addPoint) {
      newPoints.push(point);

      setPoints(newPoints);
    }

    if ($el.current && newPoints.length > 0) {
=======
    const newLines = [...lines];

    if (addLine && currentLine.length > 0) {
      newLines.push([...currentLine, point]);
      setCurrentLine([]);
    }

    setLines(newLines);

    if ($el.current && newLines.length > 0) {
>>>>>>> main
      const ctx = $el.current.getContext('2d');

      if (ctx) {
        ctx.restore();

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

<<<<<<< HEAD
        const pathData = new Path2D(
          getSvgPathFromStroke(getStroke(newPoints, perfectFreehandOptions)),
        );

        ctx.fill(pathData);

        ctx.save();
      }

      onChange?.($el.current.toDataURL());
    }

    setPoints([]);
=======
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
>>>>>>> main
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
<<<<<<< HEAD
=======
      $imageData.current = null;
>>>>>>> main
    }

    onChange?.(null);

<<<<<<< HEAD
    setPoints([]);
=======
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
>>>>>>> main
  };

  useEffect(() => {
    if ($el.current) {
      $el.current.width = $el.current.clientWidth * DPI;
      $el.current.height = $el.current.clientHeight * DPI;
    }
  }, []);

<<<<<<< HEAD
  useEffect(() => {
=======
  unsafe_useEffectOnce(() => {
>>>>>>> main
    if ($el.current && typeof defaultValue === 'string') {
      const ctx = $el.current.getContext('2d');

      const { width, height } = $el.current;

      const img = new Image();

      img.onload = () => {
        ctx?.drawImage(img, 0, 0, Math.min(width, img.width), Math.min(height, img.height));
<<<<<<< HEAD
=======

        const defaultImageData = ctx?.getImageData(0, 0, width, height) || null;

        $imageData.current = defaultImageData;
>>>>>>> main
      };

      img.src = defaultValue;
    }
<<<<<<< HEAD
  }, [defaultValue]);

  return (
    <div className={cn('relative block', containerClassName)}>
=======
  });

  return (
    <div
      className={cn('relative block', containerClassName, {
        'pointer-events-none opacity-50': disabled,
      })}
    >
>>>>>>> main
      <canvas
        ref={$el}
        className={cn('relative block dark:invert', className)}
        style={{ touchAction: 'none' }}
        onPointerMove={(event) => onMouseMove(event)}
        onPointerDown={(event) => onMouseDown(event)}
        onPointerUp={(event) => onMouseUp(event)}
        onPointerLeave={(event) => onMouseLeave(event)}
        onPointerEnter={(event) => onMouseEnter(event)}
        {...props}
      />

<<<<<<< HEAD
      <div className="absolute bottom-4 right-4">
        <button
          type="button"
          className="focus-visible:ring-ring ring-offset-background text-muted-foreground rounded-full p-0 text-xs focus-visible:outline-none focus-visible:ring-2"
=======
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          type="button"
          className="focus-visible:ring-ring ring-offset-background text-muted-foreground/60 hover:text-muted-foreground rounded-full p-0 text-xs focus-visible:outline-none focus-visible:ring-2"
>>>>>>> main
          onClick={() => onClearClick()}
        >
          Clear Signature
        </button>
      </div>
<<<<<<< HEAD
=======

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
>>>>>>> main
    </div>
  );
};
