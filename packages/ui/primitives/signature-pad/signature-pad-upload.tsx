import { unsafe_useEffectOnce } from '@documenso/lib/client-only/hooks/use-effect-once';
import { SIGNATURE_CANVAS_DPI } from '@documenso/lib/constants/signatures';
import { AppError } from '@documenso/lib/errors/app-error';
import { Trans, useLingui } from '@lingui/react/macro';
import { motion } from 'framer-motion';
import { UploadCloudIcon, ZoomInIcon, ZoomOutIcon } from 'lucide-react';
import type { PointerEvent } from 'react';
import { useRef, useState } from 'react';
import { match } from 'ts-pattern';

import { cn } from '../../lib/utils';
import { useToast } from '../use-toast';
import { checkSignatureValidity } from './helper';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.1;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const SignatureUploadErrorCode = {
  InvalidFileType: 'INVALID_FILE_TYPE',
  FileTooLarge: 'FILE_TOO_LARGE',
  InvalidImageDimensions: 'INVALID_IMAGE_DIMENSIONS',
  ImageLoadFailed: 'IMAGE_LOAD_FAILED',
} as const;

const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      throw new AppError(SignatureUploadErrorCode.InvalidFileType);
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new AppError(SignatureUploadErrorCode.FileTooLarge);
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Vector images without explicit dimensions, such as an SVG with only a
      // viewBox, can report a zero width or height. Drawing them would produce
      // NaN geometry and silently export a blank signature.
      if (img.width === 0 || img.height === 0) {
        reject(new AppError(SignatureUploadErrorCode.InvalidImageDimensions));
        return;
      }

      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new AppError(SignatureUploadErrorCode.ImageLoadFailed));
    };

    img.src = objectUrl;
  });
};

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
  clientToCanvasScale: number;
};

export type SignaturePadUploadProps = {
  className?: string;
  value: string;
  onChange: (_signatureDataUrl: string) => void;
};

export const SignaturePadUpload = ({ className, value, onChange, ...props }: SignaturePadUploadProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const $el = useRef<HTMLCanvasElement>(null);
  const $fileInput = useRef<HTMLInputElement>(null);

  const $sourceImage = useRef<HTMLImageElement | null>(null);
  const $transform = useRef({ zoom: 1, offsetX: 0, offsetY: 0 });
  const $drag = useRef<DragState | null>(null);
  const $pendingFrame = useRef<number | null>(null);

  /**
   * Incremented for every image load so stale async loads can be discarded.
   */
  const $loadGeneration = useRef(0);

  const [hasImage, setHasImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isSignatureValid, setIsSignatureValid] = useState<boolean | null>(null);

  /**
   * The scale at which the image fits entirely within the canvas while
   * preserving its aspect ratio.
   */
  const getFitScale = (image: HTMLImageElement, canvas: HTMLCanvasElement) =>
    Math.min(canvas.width / image.width, canvas.height / image.height);

  const draw = () => {
    const canvas = $el.current;
    const image = $sourceImage.current;

    if (!canvas || !image) {
      return;
    }

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    const { zoom: currentZoom, offsetX, offsetY } = $transform.current;

    const scale = getFitScale(image, canvas) * currentZoom;

    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;

    const x = (canvas.width - drawWidth) / 2 + offsetX;
    const y = (canvas.height - drawHeight) / 2 + offsetY;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(image, x, y, drawWidth, drawHeight);
  };

  const requestDraw = () => {
    if ($pendingFrame.current !== null) {
      return;
    }

    $pendingFrame.current = requestAnimationFrame(() => {
      $pendingFrame.current = null;
      draw();
    });
  };

  /**
   * Export the canvas exactly as displayed, so the frame is the signature.
   *
   * The signature is only committed when it covers enough of the canvas to be
   * considered valid, otherwise the value is cleared so an invalid signature
   * cannot be submitted.
   */
  const commitChange = () => {
    if (!$el.current) {
      return;
    }

    const isValid = checkSignatureValidity($el);

    setIsSignatureValid(isValid);

    onChange?.(isValid ? $el.current.toDataURL() : '');
  };

  const applyZoom = (nextZoom: number) => {
    if (!$sourceImage.current) {
      return;
    }

    const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);

    $transform.current.zoom = clampedZoom;

    setZoom(clampedZoom);

    draw();
    commitChange();
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = $el.current;

    if (!canvas || !$sourceImage.current) {
      return;
    }

    // Only drag with the primary pointer and main button, otherwise a
    // right/middle click can arm a drag whose pointerup is swallowed by the
    // context menu, leaving the image glued to the cursor.
    if (!event.isPrimary || event.button !== 0) {
      return;
    }

    event.preventDefault();

    canvas.setPointerCapture(event.pointerId);

    const rect = canvas.getBoundingClientRect();

    $drag.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: $transform.current.offsetX,
      startOffsetY: $transform.current.offsetY,
      clientToCanvasScale: rect.width > 0 ? canvas.width / rect.width : SIGNATURE_CANVAS_DPI,
    };

    setIsDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = $drag.current;

    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    event.preventDefault();

    $transform.current.offsetX = drag.startOffsetX + (event.clientX - drag.startClientX) * drag.clientToCanvasScale;
    $transform.current.offsetY = drag.startOffsetY + (event.clientY - drag.startClientY) * drag.clientToCanvasScale;

    requestDraw();
  };

  const onPointerEnd = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = $drag.current;

    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    const hasMoved =
      $transform.current.offsetX !== drag.startOffsetX || $transform.current.offsetY !== drag.startOffsetY;

    $drag.current = null;
    setIsDragging(false);

    if ($el.current?.hasPointerCapture(event.pointerId)) {
      $el.current.releasePointerCapture(event.pointerId);
    }

    if ($pendingFrame.current !== null) {
      cancelAnimationFrame($pendingFrame.current);
      $pendingFrame.current = null;
    }

    draw();

    // Avoid emitting an identical signature when the pointer never moved,
    // such as a plain click on the canvas.
    if (hasMoved) {
      commitChange();
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    // Allow re-selecting the same file to trigger another change event.
    event.target.value = '';

    if (!file) {
      return;
    }

    const generation = ++$loadGeneration.current;

    let img: HTMLImageElement;

    try {
      img = await loadImage(file);
    } catch (err) {
      console.error(err);

      const error = AppError.parseError(err);

      const description = match(error.code)
        .with(SignatureUploadErrorCode.InvalidFileType, () => t`Please upload a valid image file.`)
        .with(SignatureUploadErrorCode.FileTooLarge, () => t`The image must be smaller than 5MB.`)
        .with(
          SignatureUploadErrorCode.InvalidImageDimensions,
          () => t`This image is invalid, please upload a valid image file.`,
        )
        .otherwise(() => t`The image could not be loaded. Please try again.`);

      toast({
        title: t`Unable to upload image`,
        description,
        variant: 'destructive',
      });

      return;
    }

    // Discard the result if another image load started in the meantime.
    if (generation !== $loadGeneration.current) {
      return;
    }

    $sourceImage.current = img;
    $transform.current = { zoom: 1, offsetX: 0, offsetY: 0 };

    setHasImage(true);
    setZoom(1);

    draw();
    commitChange();
  };

  unsafe_useEffectOnce(() => {
    if ($el.current) {
      $el.current.width = $el.current.clientWidth * SIGNATURE_CANVAS_DPI;
      $el.current.height = $el.current.clientHeight * SIGNATURE_CANVAS_DPI;
    }

    if ($el.current && value) {
      const generation = ++$loadGeneration.current;

      const img = new Image();

      img.onload = () => {
        // Discard the result if another image load started in the meantime.
        if (generation !== $loadGeneration.current) {
          return;
        }

        // Display the existing signature aspect-fitted and centered, ready to
        // be adjusted further with zoom and drag. This is display-only and
        // intentionally does not call onChange.
        $sourceImage.current = img;
        $transform.current = { zoom: 1, offsetX: 0, offsetY: 0 };

        setHasImage(true);
        setZoom(1);

        draw();
      };

      img.onerror = () => {
        console.error(new AppError(SignatureUploadErrorCode.ImageLoadFailed));
      };

      img.src = value;
    }

    return () => {
      if ($pendingFrame.current !== null) {
        cancelAnimationFrame($pendingFrame.current);
        $pendingFrame.current = null;
      }
    };
  });

  return (
    <div className={cn('relative h-full w-full', className)}>
      <canvas
        data-testid="signature-pad-upload"
        ref={$el}
        className={cn('h-full w-full dark:hue-rotate-180 dark:invert', {
          'cursor-grab': hasImage && !isDragging,
          'cursor-grabbing': isDragging,
        })}
        style={{ touchAction: 'none' }}
        {...props}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      />

      <input ref={$fileInput} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {hasImage && (
        <div className="absolute top-2 right-2 flex items-center gap-2">
          <button
            type="button"
            title={t`Zoom out`}
            disabled={zoom <= MIN_ZOOM}
            className="rounded-full p-0 text-muted-foreground/60 ring-offset-background hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
            onClick={() => applyZoom($transform.current.zoom / ZOOM_STEP)}
          >
            <ZoomOutIcon className="h-4 w-4" />
            <span className="sr-only">
              <Trans>Zoom out</Trans>
            </span>
          </button>

          <button
            type="button"
            title={t`Zoom in`}
            disabled={zoom >= MAX_ZOOM}
            className="rounded-full p-0 text-muted-foreground/60 ring-offset-background hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
            onClick={() => applyZoom($transform.current.zoom * ZOOM_STEP)}
          >
            <ZoomInIcon className="h-4 w-4" />
            <span className="sr-only">
              <Trans>Zoom in</Trans>
            </span>
          </button>
        </div>
      )}

      {hasImage && (
        <div className="absolute right-3 bottom-3 flex gap-2">
          <button
            type="button"
            className="rounded-full p-0 text-[0.688rem] text-muted-foreground/60 ring-offset-background hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => $fileInput.current?.click()}
          >
            <Trans>Upload New Image</Trans>
          </button>
        </div>
      )}

      {isSignatureValid === false && (
        <div className="absolute bottom-4 left-4 flex gap-2">
          <span className="text-destructive text-xs">
            <Trans>Signature is too small</Trans>
          </span>
        </div>
      )}

      {!hasImage && (
        <motion.button
          type="button"
          className="absolute inset-0 flex h-full w-full items-center justify-center"
          initial="initial"
          animate="animate"
          whileHover="hover"
          onClick={() => $fileInput.current?.click()}
        >
          <motion.div>
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <div className="flex flex-col items-center">
                <UploadCloudIcon className="h-8 w-8" />
                <span className="font-semibold text-lg">
                  <Trans>Upload Signature</Trans>
                </span>
              </div>
            </div>
          </motion.div>
        </motion.button>
      )}
    </div>
  );
};
