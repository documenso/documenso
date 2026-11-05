/**
 * The `KONVA_` prefix marks values which only affect how nodes are painted and
 * are never persisted, unlike `DEFAULT_CONTENT_*` and `FIELD_DEFAULT_*`.
 */

/**
 * Konva hit detection ignores alpha, so this keeps a filled area clickable
 * while painting nothing. The field renderer also normalizes any transparent
 * customer style to this exact string so "asked for transparent" can be told
 * apart from "no custom style".
 */
export const KONVA_TRANSPARENT_FILL = 'rgba(0, 0, 0, 0)';

const KONVA_SELECTION_RGB = '24, 160, 251';

export const KONVA_SELECTION_OUTLINE_COLOR = `rgba(${KONVA_SELECTION_RGB}, 0.8)`;

export const KONVA_SELECTION_FILL_COLOR = `rgba(${KONVA_SELECTION_RGB}, 0.3)`;
