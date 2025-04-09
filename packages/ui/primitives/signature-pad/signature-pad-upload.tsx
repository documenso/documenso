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
