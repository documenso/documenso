/**
 * Shared constants for field dimension enforcement.
 *
 * These constants ensure consistency between:
 * 1. AI prompt (server/api/ai.ts) - instructs Gemini on minimum field dimensions
 * 2. Client enforcement (envelope-editor-fields-page.tsx) - fallback validation
 */

/**
 * Minimum field height in pixels.
 * Fields smaller than this will be expanded to meet minimum usability requirements.
 */
export const MIN_FIELD_HEIGHT_PX = 30;

/**
 * Minimum field width in pixels.
 * Fields smaller than this will be expanded to meet minimum usability requirements.
 */
export const MIN_FIELD_WIDTH_PX = 36;
