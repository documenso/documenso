'use client';

import type { HTMLAttributes, MouseEvent, PointerEvent, TouchEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import type { StrokeOptions } from 'perfect-freehand';
import { getStroke } from 'perfect-freehand';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { cn } from '../../lib/utils';
import { Input } from '../input';
import { getSvgPathFromStroke } from './helper';
import { Point } from './point';

const DPI = 2;

export type SignaturePadProps = Omit<HTMLAttributes<HTMLCanvasElement>, 'onChange'> & {
  signature: string | null;
  setSignature: (_value: string | null) => void;
  onChange?: (_signatureDataUrl: string | null) => void;
  containerClassName?: string;
  clearSignatureClassName?: string;
  onFormSubmit?: (_data: TSigningpadSchema) => void;
};

const ZSigningpadSchema = z.union([
  z.object({
    signatureDataUrl: z.string().min(1),
    signatureText: z.null().or(z.string().max(0)),
  }),
  z.object({
    signatureDataUrl: z.null().or(z.string().max(0)),
    signatureText: z.string().trim().min(1),
  }),
]);

export type TSigningpadSchema = z.infer<typeof ZSigningpadSchema>;

export const SignaturePad = ({
  className,
  containerClassName,
  defaultValue,
  clearSignatureClassName,
  onFormSubmit,
  onChange,
  signature,
  setSignature,
  ...props
}: SignaturePadProps) => {
  const $el = useRef<HTMLCanvasElement>(null);

  const [isPressed, setIsPressed] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<TSigningpadSchema>({
    mode: 'onChange',
    defaultValues: {
      signatureDataUrl: signature || null,
      signatureText: '',
    },
    resolver: zodResolver(ZSigningpadSchema),
  });

  // const signatureDataUrl = watch('signatureDataUrl');
  const signatureText = watch('signatureText');

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
  };

  const onMouseMove = (event: MouseEvent | PointerEvent | TouchEvent) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    if (!isPressed) {
      return;
    }

    const point = Point.fromEvent(event, DPI, $el.current);

    if (point.distanceTo(points[points.length - 1]) > 5) {
      const newPoints = [...points, point];

      setPoints(newPoints);

      if ($el.current) {
        const ctx = $el.current.getContext('2d');

        if (ctx) {
          ctx.restore();

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          const pathData = new Path2D(
            getSvgPathFromStroke(getStroke(points, perfectFreehandOptions)),
          );

          ctx.fill(pathData);
        }
      }
    }
  };

  const onMouseUp = (event: MouseEvent | PointerEvent | TouchEvent, addPoint = true) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    setIsPressed(false);

    const point = Point.fromEvent(event, DPI, $el.current);

    const newPoints = [...points];

    if (addPoint) {
      newPoints.push(point);

      setPoints(newPoints);
    }

    if ($el.current && newPoints.length > 0) {
      const ctx = $el.current.getContext('2d');

      if (ctx) {
        ctx.restore();

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const pathData = new Path2D(
          getSvgPathFromStroke(getStroke(newPoints, perfectFreehandOptions)),
        );

        ctx.fill(pathData);

        ctx.save();
      }

      onChange?.($el.current.toDataURL());
    }

    setPoints([]);
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
    }

    onChange?.(null);

    setPoints([]);
  };

  useEffect(() => {
    if ($el.current) {
      $el.current.width = $el.current.clientWidth * DPI;
      $el.current.height = $el.current.clientHeight * DPI;
    }
  }, []);

  useEffect(() => {
    if ($el.current && typeof defaultValue === 'string') {
      const ctx = $el.current.getContext('2d');

      const { width, height } = $el.current;

      const img = new Image();

      img.onload = () => {
        ctx?.drawImage(img, 0, 0, Math.min(width, img.width), Math.min(height, img.height));
      };

      img.src = defaultValue;
    }
  }, [defaultValue]);

  return (
    <form onSubmit={handleSubmit(onFormSubmit ?? (() => undefined))}>
      <div className={cn('relative block', containerClassName)}>
        <div className="flex h-44 items-center justify-center pb-6">
          {!signatureText && signature && (
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
          )}

          {signatureText && (
            <p
              className={cn(
                'text-foreground text-4xl font-semibold [font-family:var(--font-caveat)]',
              )}
            >
              {signatureText}
            </p>
          )}
        </div>

        <div
          className="absolute inset-x-0 bottom-0 flex cursor-auto items-end justify-between px-4 pb-1 pt-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Input
            id="signatureText"
            className="text-foreground placeholder:text-muted-foreground border-none bg-transparent p-0 text-sm focus-visible:bg-transparent focus-visible:outline-none focus-visible:ring-0"
            placeholder="Draw or type name here"
            // disabled={isSubmitting || signature !== null}
            disabled={isSubmitting}
            {...register('signatureText', {
              onChange: (e) => {
                if (e.target.value !== '') {
                  setValue('signatureDataUrl', null);
                }

                setValue('signatureText', e.target.value);
              },

              onBlur: (e) => {
                if (e.target.value === '') {
                  return setValue('signatureText', '');
                }

                setSignature(e.target.value.trimStart());
              },
            })}
          />

          {/* <div className="absolute bottom-3 right-4">
                        <button
                          type="button"
                          className="focus-visible:ring-ring ring-offset-background text-muted-foreground rounded-full p-0 text-xs focus-visible:outline-none focus-visible:ring-2"
                          onClick={() => console.log('clear')}
                        >
                          Clear Signature
                        </button>
                      </div> */}
        </div>

        <div className={cn('absolute bottom-4 right-4', clearSignatureClassName)}>
          <button
            type="button"
            className="focus-visible:ring-ring ring-offset-background text-muted-foreground rounded-full p-0 text-xs focus-visible:outline-none focus-visible:ring-2"
            onClick={() => onClearClick()}
          >
            Clear Signature
          </button>
        </div>
      </div>
    </form>
  );
};
