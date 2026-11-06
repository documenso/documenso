import { env } from '../utils/env';

export const APP_CONTENT_IMAGE_UPLOAD_SIZE_LIMIT = Number(env('NEXT_PUBLIC_CONTENT_IMAGE_SIZE_UPLOAD_LIMIT')) || 10;

/**
 * SVG is deliberately excluded, since it can embed scripts and external
 * references and is not rasterized consistently across renderers.
 */
export const APP_CONTENT_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/**
 * In pixels. Content images are drawn at page scale, so anything beyond this
 * only inflates storage and render times without a visible difference.
 */
export const CONTENT_IMAGE_MAX_EDGE = 2048;

/**
 * Bounds the memory used to decode an upload, since a tiny compressed file
 * can expand to a huge bitmap. Comfortably fits a 12 megapixel phone photo.
 */
export const CONTENT_IMAGE_MAX_INPUT_PIXELS = 25_000_000;

/**
 * Text is the only free-form value on a content, and it is recorded in full
 * in the audit log on every save, so it is capped the same as a document
 * message.
 */
export const CONTENT_TEXT_MAX_LENGTH = 5_000;

/**
 * 0 = Unlimited contents.
 */
export const DEFAULT_ENVELOPE_CONTENT_COUNT = 0;

/**
 * 0 = Unlimited image contents.
 */
export const DEFAULT_ENVELOPE_CONTENT_IMAGE_COUNT = 0;
