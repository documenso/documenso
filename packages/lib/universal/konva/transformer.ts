/**
 * The resize anchors of a Konva transformer.
 */
export const TRANSFORMER_RESIZE_ANCHORS = [
  'top-left',
  'top-center',
  'top-right',
  'middle-right',
  'middle-left',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

/**
 * The corner anchors only, which resize both axes at once.
 */
export const TRANSFORMER_CORNER_ANCHORS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

/**
 * The per selection configuration applied to a shared Konva transformer.
 */
export type TransformerSelectionConfig = {
  enabledAnchors: string[];
  rotateEnabled: boolean;

  /**
   * Whether resizing preserves the aspect ratio of the selection.
   */
  keepRatio: boolean;

  /**
   * Whether the border around the selection is drawn.
   */
  borderEnabled: boolean;
};

/**
 * Resizable in every direction, no rotation.
 */
export const DEFAULT_TRANSFORMER_SELECTION_CONFIG: TransformerSelectionConfig = {
  enabledAnchors: TRANSFORMER_RESIZE_ANCHORS,
  rotateEnabled: false,
  keepRatio: false,
  borderEnabled: true,
};

/**
 * Move only, no resizing or rotation.
 */
export const MOVE_ONLY_TRANSFORMER_SELECTION_CONFIG: TransformerSelectionConfig = {
  enabledAnchors: [],
  rotateEnabled: false,
  keepRatio: false,
  borderEnabled: true,
};

/**
 * The box a Konva transformer proposes during a resize, in absolute stage
 * coordinates.
 */
export type TransformerBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

/**
 * Pin a resize to the page so nothing can be stretched past its edges.
 *
 * Each edge is clamped independently: an anchor dragged past the page keeps
 * its edge on the page boundary while the opposite edge stays where it is,
 * and the other axis still follows the mouse. The mouse itself is free to
 * leave the page.
 */
export const boundTransformerBoxToPage = (
  box: TransformerBox,
  page: { width: number; height: number },
): TransformerBox => {
  if (box.rotation !== 0) {
    return box;
  }

  const left = Math.max(0, box.x);
  const top = Math.max(0, box.y);
  const right = Math.min(page.width, box.x + box.width);
  const bottom = Math.min(page.height, box.y + box.height);

  return {
    ...box,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
};
