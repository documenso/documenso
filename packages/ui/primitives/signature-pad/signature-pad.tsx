'use client';

import type { HTMLAttributes, MouseEvent, PointerEvent, TouchEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Caveat } from 'next/font/google';

import { Trans } from '@lingui/macro';
import { Undo2, Upload } from 'lucide-react';
import type { StrokeOptions } from 'perfect-freehand';
import { getStroke } from 'perfect-freehand';

import { unsafe_useEffectOnce } from '@documenso/lib/client-only/hooks/use-effect-once';
import { Input } from '@documenso/ui/primitives/input';
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

const fontCaveat = Caveat({
  weight: ['500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-caveat',
});

const DPI = 2;

const isBase64Image = (value: string) => value.startsWith('data:image/png;base64,');

const loadImage = async (file: File | undefined): Promise<HTMLImageElement> => {
  if (!file) {
    throw new Error('No file selected');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Invalid file type');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image size should be less than 5MB');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
};

const loadImageOntoCanvas = (
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): ImageData => {
  const scale = Math.min((canvas.width * 0.8) / image.width, (canvas.height * 0.8) / image.height);

  const x = (canvas.width - image.width * scale) / 2;
  const y = (canvas.height - image.height * scale) / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(image, x, y, image.width * scale, image.height * scale);

  ctx.restore();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  return imageData;
};

export type SignaturePadProps = Omit<HTMLAttributes<HTMLCanvasElement>, 'onChange'> & {
  onChange?: (_signatureDataUrl: string | null) => void;
  containerClassName?: string;
  disabled?: boolean;
  allowTypedSignature?: boolean;
  defaultValue?: string;
  onValidityChange?: (isValid: boolean) => void;
  minCoverageThreshold?: number;
};

export const SignaturePad = ({
  className,
  containerClassName,
  defaultValue,
  onChange,
  disabled = false,
  allowTypedSignature,
  onValidityChange,
  minCoverageThreshold = 0.01,
  ...props
}: SignaturePadProps) => {
  const $el = useRef<HTMLCanvasElement>(null);
  const $imageData = useRef<ImageData | null>(null);
  const $fileInput = useRef<HTMLInputElement>(null);

  const [isPressed, setIsPressed] = useState(false);
  const [lines, setLines] = useState<Point[][]>([]);
  const [currentLine, setCurrentLine] = useState<Point[]>([]);
  const [selectedColor, setSelectedColor] = useState('black');
  const [typedSignature, setTypedSignature] = useState(
    defaultValue && !isBase64Image(defaultValue) ? defaultValue : '',
  );

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

  const checkSignatureValidity = () => {
    if ($el.current) {
      const ctx = $el.current.getContext('2d');

      if (ctx) {
        const imageData = ctx.getImageData(0, 0, $el.current.width, $el.current.height);
        const data = imageData.data;
        let filledPixels = 0;
        const totalPixels = data.length / 4;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 0) filledPixels++;
        }

        const filledPercentage = filledPixels / totalPixels;
        const isValid = filledPercentage > minCoverageThreshold;
        onValidityChange?.(isValid);

        return isValid;
      }
    }
  };

  const onMouseDown = (event: MouseEvent | PointerEvent | TouchEvent) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    setIsPressed(true);

    if (typedSignature) {
      setTypedSignature('');
      if ($el.current) {
        const ctx = $el.current.getContext('2d');
        ctx?.clearRect(0, 0, $el.current.width, $el.current.height);
      }
    }

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

        const isValidSignature = checkSignatureValidity();

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

    onMouseUp(event, false);
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

    onChange?.(null);

    setTypedSignature('');
    setLines([]);
    setCurrentLine([]);
    setIsPressed(false);
  };

  const renderTypedSignature = () => {
    if ($el.current && typedSignature) {
      const ctx = $el.current.getContext('2d');

      if (ctx) {
        const canvasWidth = $el.current.width;
        const canvasHeight = $el.current.height;
        const fontFamily = String(fontCaveat.style.fontFamily);

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = selectedColor;

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

        const textWidth = ctx.measureText(typedSignature).width;

        if (textWidth > desiredWidth) {
          fontSize = fontSize * (desiredWidth / textWidth);
        }

        // Set final font and render text
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillText(typedSignature, canvasWidth / 2, canvasHeight / 2);
      }
    }
  };

  const handleTypedSignatureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;

    // Deny input while drawing.
    if (isPressed) {
      return;
    }

    if (lines.length > 0) {
      setLines([]);
      setCurrentLine([]);
    }

    setTypedSignature(newValue);

    if ($el.current) {
      const ctx = $el.current.getContext('2d');
      ctx?.clearRect(0, 0, $el.current.width, $el.current.height);
    }

    if (newValue.trim() !== '') {
      onChange?.(newValue);
      onValidityChange?.(true);
    } else {
      onChange?.(null);
      onValidityChange?.(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const img = await loadImage(event.target.files?.[0]);

      if (!$el.current) return;

      const ctx = $el.current.getContext('2d');
      if (!ctx) return;

      $imageData.current = loadImageOntoCanvas(img, $el.current, ctx);
      onChange?.($el.current.toDataURL());

      setLines([]);
      setCurrentLine([]);
      setTypedSignature('');
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (typedSignature.trim() !== '' && !isBase64Image(typedSignature)) {
      renderTypedSignature();
      onChange?.(typedSignature);
    }
  }, [typedSignature, selectedColor]);

  const onUndoClick = () => {
    if (lines.length === 0 && typedSignature.length === 0) {
      return;
    }

    if (typedSignature.length > 0) {
      const newTypedSignature = typedSignature.slice(0, -1);
      setTypedSignature(newTypedSignature);
      // You might want to call onChange here as well
      // onChange?.(newTypedSignature);
    } else {
      const newLines = lines.slice(0, -1);
      setLines(newLines);

      // Clear and redraw the canvas
      if ($el.current) {
        const ctx = $el.current.getContext('2d');
        const { width, height } = $el.current;
        ctx?.clearRect(0, 0, width, height);

        if (typeof defaultValue === 'string' && $imageData.current) {
          ctx?.putImageData($imageData.current, 0, 0);
        }

        newLines.forEach((line) => {
          const pathData = new Path2D(
            getSvgPathFromStroke(getStroke(line, perfectFreehandOptions)),
          );
          ctx?.fill(pathData);
        });

        onChange?.($el.current.toDataURL());
      }
    }
  };

  useEffect(() => {
    if ($el.current) {
      $el.current.width = $el.current.clientWidth * DPI;
      $el.current.height = $el.current.clientHeight * DPI;
    }

    if (defaultValue && typedSignature) {
      renderTypedSignature();
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
      className={cn('relative block select-none', containerClassName, {
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

      {allowTypedSignature && (
        <div
          className={cn('ml-4 pb-1', {
            'ml-10': lines.length > 0 || typedSignature.length > 0,
          })}
        >
          <Input
            placeholder="Type your signature"
            className="w-1/2 border-none p-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            value={typedSignature}
            onChange={handleTypedSignatureChange}
          />
        </div>
      )}

      <div className="text-foreground absolute left-3 top-3 filter">
        <div
          className="focus-visible:ring-ring ring-offset-background text-muted-foreground/60 hover:text-muted-foreground flex cursor-pointer flex-row gap-2 rounded-full p-0 text-[0.688rem] focus-visible:outline-none focus-visible:ring-2"
          onClick={() => $fileInput.current?.click()}
        >
          <Input
            ref={$fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
            disabled={disabled}
          />
          <Upload className="h-4 w-4" />
          <span>
            <Trans>Upload Signature</Trans>
          </span>
        </div>
      </div>

      <div className="text-foreground absolute right-2 top-2 filter">
        <Select defaultValue={selectedColor} onValueChange={(value) => setSelectedColor(value)}>
          <SelectTrigger className="h-auto w-auto border-none p-0.5">
            <SelectValue placeholder="" />
          </SelectTrigger>

          <SelectContent className="w-[100px]" align="end">
            <SelectItem value="black">
              <div className="text-muted-foreground flex items-center text-[0.688rem]">
                <div className="border-border mr-1 h-4 w-4 rounded-full border-2 bg-black shadow-sm" />
                <Trans>Black</Trans>
              </div>
            </SelectItem>

            <SelectItem value="red">
              <div className="text-muted-foreground flex items-center text-[0.688rem]">
                <div className="border-border mr-1 h-4 w-4 rounded-full border-2 bg-[red] shadow-sm" />
                <Trans>Red</Trans>
              </div>
            </SelectItem>

            <SelectItem value="blue">
              <div className="text-muted-foreground flex items-center text-[0.688rem]">
                <div className="border-border mr-1 h-4 w-4 rounded-full border-2 bg-[blue] shadow-sm" />
                <Trans>Blue</Trans>
              </div>
            </SelectItem>

            <SelectItem value="green">
              <div className="text-muted-foreground flex items-center text-[0.688rem]">
                <div className="border-border mr-1 h-4 w-4 rounded-full border-2 bg-[green] shadow-sm" />
                <Trans>Green</Trans>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="absolute bottom-3 right-3 flex gap-2">
        <button
          type="button"
          className="focus-visible:ring-ring ring-offset-background text-muted-foreground/60 hover:text-muted-foreground rounded-full p-0 text-[0.688rem] focus-visible:outline-none focus-visible:ring-2"
          onClick={() => onClearClick()}
        >
          <Trans>Clear Signature</Trans>
        </button>
      </div>

      {(lines.length > 0 || typedSignature.length > 0) && (
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
