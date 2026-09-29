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
 * The longest edge an uploaded content image is scaled down to, in pixels.
 *
 * Content images are drawn at page scale, so anything beyond this only
 * inflates storage and render times without a visible difference.
 */
export const CONTENT_IMAGE_MAX_EDGE = 2048;

/**
 * The maximum number of pixels an uploaded image may decode to.
 *
 * Bounds the memory used to decode an upload, since a tiny compressed file
 * can expand to a huge bitmap. Comfortably fits a 12 megapixel phone photo.
 */
export const CONTENT_IMAGE_MAX_INPUT_PIXELS = 25_000_000;

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
