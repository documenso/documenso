/**
 * Konva presentation constants shared by the field and content renderers.
 *
 * The `KONVA_` prefix marks values which only affect how nodes are painted
 * on the canvas. They are never persisted, unlike the `DEFAULT_CONTENT_*`
 * and `FIELD_DEFAULT_*` values which seed the stored metadata.
 */

/**
 * A fully transparent fill.
 *
 * Konva hit detection ignores alpha, so this keeps a filled area clickable
 * while painting nothing. The field renderer also normalizes any transparent
 * customer style to this exact string so "asked for transparent" can be told
 * apart from "no custom style".
 */
export const KONVA_TRANSPARENT_FILL = 'rgba(0, 0, 0, 0)';

/**
 * The accent used for everything selection related on the canvas: hover
 * outlines, the marquee and the pending field box. Derived at the alphas
 * below so the shades always share the one hue.
 */
const KONVA_SELECTION_RGB = '24, 160, 251';

/**
 * A solid outline, e.g. around a hovered content.
 */
export const KONVA_SELECTION_OUTLINE_COLOR = `rgba(${KONVA_SELECTION_RGB}, 0.8)`;

/**
 * A translucent fill, e.g. the marquee while dragging one out.
 */
export const KONVA_SELECTION_FILL_COLOR = `rgba(${KONVA_SELECTION_RGB}, 0.3)`;
