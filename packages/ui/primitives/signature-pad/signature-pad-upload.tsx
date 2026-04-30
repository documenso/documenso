import { useRef } from 'react';

import { Trans } from '@lingui/react/macro';
import { motion } from 'framer-motion';
import { UploadCloudIcon } from 'lucide-react';

import { unsafe_useEffectOnce } from '@documenso/lib/client-only/hooks/use-effect-once';
import { SIGNATURE_CANVAS_DPI } from '@documenso/lib/constants/signatures';

import { cn } from '../../lib/utils';

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

const getSignatureImageBounds = (image: HTMLImageElement): DOMRect | null => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    return null;
  }

  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const index = (y * canvas.width + x) * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const alpha = data[index + 3];

      const isTransparent = alpha <= 10;
      const isNearWhite = red > 245 && green > 245 && blue > 245;

      if (!isTransparent && !isNearWhite) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    return null;
  }

  return new DOMRect(minX, minY, maxX - minX + 1, maxY - minY + 1);
};

const loadImageOntoCanvas = (
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): ImageData => {
  const sourceBounds =
    getSignatureImageBounds(image) ?? new DOMRect(0, 0, image.width, image.height);

  const scale = Math.min(
    canvas.width / sourceBounds.width,
    canvas.height / sourceBounds.height,
  );

  const targetWidth = sourceBounds.width * scale;
  const targetHeight = sourceBounds.height * scale;
  const x = (canvas.width - targetWidth) / 2;
  const y = (canvas.height - targetHeight) / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    sourceBounds.x,
    sourceBounds.y,
    sourceBounds.width,
    sourceBounds.height,
    x,
    y,
    targetWidth,
    targetHeight,
  );

  ctx.restore();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  return imageData;
};

export type SignaturePadUploadProps = {
  className?: string;
  value: string;
  onChange: (_signatureDataUrl: string) => void;
};

export const SignaturePadUpload = ({
  className,
  value,
  onChange,
  ...props
}: SignaturePadUploadProps) => {
  const $el = useRef<HTMLCanvasElement>(null);
  const $imageData = useRef<ImageData | null>(null);
  const $fileInput = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const img = await loadImage(event.target.files?.[0]);

      if (!$el.current) return;

      const ctx = $el.current.getContext('2d');
      if (!ctx) return;

      $imageData.current = loadImageOntoCanvas(img, $el.current, ctx);
      onChange?.($el.current.toDataURL());
    } catch (error) {
      console.error(error);
    }
  };

  unsafe_useEffectOnce(() => {
    // Todo: Not really sure if this is required for uploaded images.
    if ($el.current) {
      $el.current.width = $el.current.clientWidth * SIGNATURE_CANVAS_DPI;
      $el.current.height = $el.current.clientHeight * SIGNATURE_CANVAS_DPI;
    }

    if ($el.current && value) {
      const ctx = $el.current.getContext('2d');

      const img = new Image();

      img.onload = () => {
        if (!$el.current || !ctx) {
          return;
        }

        const defaultImageData = loadImageOntoCanvas(img, $el.current, ctx);

        $imageData.current = defaultImageData;
      };

      img.src = value;
    }
  });

  return (
    <div className={cn('relative h-full w-full', className)}>
      <canvas
        data-testid="signature-pad-upload"
        ref={$el}
        className="h-full w-full dark:hue-rotate-180 dark:invert"
        style={{ touchAction: 'none' }}
        {...props}
      />

      <input
        ref={$fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      <motion.button
        className="absolute inset-0 flex h-full w-full items-center justify-center"
        initial="initial"
        animate="animate"
        whileHover="hover"
        onClick={() => $fileInput.current?.click()}
      >
        {!value && (
          <motion.div>
            <div className="text-muted-foreground flex flex-col items-center justify-center">
              <div className="flex flex-col items-center">
                <UploadCloudIcon className="h-8 w-8" />
                <span className="text-lg font-semibold">
                  <Trans>Upload Signature</Trans>
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </motion.button>
    </div>
  );
};
