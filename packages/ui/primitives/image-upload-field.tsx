import { SIGNATURE_CANVAS_DPI } from '@documenso/lib/constants/signatures';
import { Trans, useLingui } from '@lingui/react/macro';
import { motion } from 'framer-motion';
import { UploadCloudIcon, XIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '../lib/utils';

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
  image: CanvasImageSource,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): ImageData => {
  const imageWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const imageHeight = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
  const scale = Math.min(canvas.width / imageWidth, canvas.height / imageHeight);

  const x = (canvas.width - imageWidth * scale) / 2;
  const y = (canvas.height - imageHeight * scale) / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(image, x, y, imageWidth * scale, imageHeight * scale);

  ctx.restore();

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

const trimTransparentMargins = (image: HTMLImageElement): HTMLCanvasElement => {
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = image.naturalWidth;
  sourceCanvas.height = image.naturalHeight;

  const sourceCtx = sourceCanvas.getContext('2d');

  if (!sourceCtx) {
    return sourceCanvas;
  }

  sourceCtx.drawImage(image, 0, 0);

  const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const { data, width, height } = imageData;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];

      if (alpha > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0 || maxY < 0) {
    return sourceCanvas;
  }

  const trimmedWidth = maxX - minX + 1;
  const trimmedHeight = maxY - minY + 1;

  if (trimmedWidth === width && trimmedHeight === height) {
    return sourceCanvas;
  }

  const trimmedCanvas = document.createElement('canvas');
  trimmedCanvas.width = trimmedWidth;
  trimmedCanvas.height = trimmedHeight;

  const trimmedCtx = trimmedCanvas.getContext('2d');

  if (!trimmedCtx) {
    return sourceCanvas;
  }

  trimmedCtx.drawImage(sourceCanvas, minX, minY, trimmedWidth, trimmedHeight, 0, 0, trimmedWidth, trimmedHeight);

  return trimmedCanvas;
};

export type ImageUploadFieldProps = {
  className?: string;
  value: string;
  onChange: (_imageDataUrl: string) => void;
};

export const ImageUploadField = ({ className, value, onChange, ...props }: ImageUploadFieldProps) => {
  const { t } = useLingui();
  const $canvas = useRef<HTMLCanvasElement>(null);
  const $fileInput = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsUploading(true);
    setError(null);
    try {
      const img = await loadImage(event.target.files?.[0]);
      const trimmedImage = trimTransparentMargins(img);

      // 1. Create a normalized base64 image without padding.
      const MAX_DIMENSION = 1000;
      const scale = Math.min(1, MAX_DIMENSION / Math.max(trimmedImage.width, trimmedImage.height));
      const width = trimmedImage.width * scale;
      const height = trimmedImage.height * scale;

      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;
      const offscreenCtx = offscreenCanvas.getContext('2d');
      if (offscreenCtx) {
        offscreenCtx.drawImage(trimmedImage, 0, 0, width, height);
        onChange?.(offscreenCanvas.toDataURL('image/png'));
      }

      // 2. Update the preview canvas.
      if ($canvas.current) {
        const ctx = $canvas.current.getContext('2d');
        if (ctx) {
          $canvas.current.width = $canvas.current.clientWidth * SIGNATURE_CANVAS_DPI;
          $canvas.current.height = $canvas.current.clientHeight * SIGNATURE_CANVAS_DPI;
          loadImageOntoCanvas(trimmedImage, $canvas.current, ctx);
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t`An unexpected error occurred`);
      }
      console.error('Image upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const clearImage = () => {
    onChange?.('');
  };

  return (
    <div className={cn('relative h-[300px] max-h-[400px] w-full overflow-hidden', className)}>
      {value ? (
        <img src={value} className="absolute inset-0 h-full w-full object-cover" alt="Uploaded preview" />
      ) : (
        <canvas ref={$canvas} className="h-full w-full object-contain" style={{ touchAction: 'none' }} {...props} />
      )}

      <input ref={$fileInput} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {!value && (
        <div
          className="absolute inset-0 z-50 flex h-full w-full cursor-pointer items-center justify-center rounded-lg border-2 border-muted-foreground/20 border-dashed bg-background/50 transition-colors hover:bg-background/80"
          onClick={() => $fileInput.current?.click()}
        >
          <motion.div className="flex flex-col items-center justify-center text-muted-foreground">
            <UploadCloudIcon className="mb-2 h-10 w-10" />
            <span className="font-semibold text-lg">
              <Trans>Upload Image</Trans>
            </span>
            <span className="text-sm opacity-70">
              <Trans>PNG, JPG or JPEG (max 5MB)</Trans>
            </span>
          </motion.div>
        </div>
      )}

      {value && (
        <button
          type="button"
          className="absolute top-2 right-2 z-50 rounded-full border bg-background p-1 transition-colors hover:bg-muted"
          onClick={clearImage}
          title="Clear image"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}

      {isUploading && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-background/50">
          <div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2"></div>
        </div>
      )}

      {error && (
        <div className="fade-in slide-in-from-bottom-1 absolute bottom-2 left-1/2 z-[70] -translate-x-1/2 animate-in rounded bg-destructive px-2 py-1 font-medium text-destructive-foreground text-xs">
          <Trans>{error}</Trans>
        </div>
      )}
    </div>
  );
};
