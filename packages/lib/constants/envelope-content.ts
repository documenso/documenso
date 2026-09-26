import { env } from '../utils/env';

/**
 * The maximum size of an image uploaded as envelope content, in MB.
 */
export const APP_CONTENT_IMAGE_UPLOAD_SIZE_LIMIT = Number(env('NEXT_PUBLIC_CONTENT_IMAGE_SIZE_UPLOAD_LIMIT')) || 10;

/**
 * The MIME types accepted for envelope content image uploads.
 *
 * SVG is deliberately excluded, since it can embed scripts and external
 * references and is not rasterized consistently across renderers.
 */
export const APP_CONTENT_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/**
 * The number of contents allowed on a single envelope.
 *
 * 0 = Unlimited contents.
 */
export const DEFAULT_ENVELOPE_CONTENT_COUNT = 0;

/**
 * The number of image contents allowed on a single envelope.
 *
 * 0 = Unlimited image contents.
 */
export const DEFAULT_ENVELOPE_CONTENT_IMAGE_COUNT = 0;
