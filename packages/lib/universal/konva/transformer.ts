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

export const TRANSFORMER_CORNER_ANCHORS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

export type TransformerSelectionConfig = {
  enabledAnchors: string[];
  rotateEnabled: boolean;

  keepRatio: boolean;

  borderEnabled: boolean;
};

export const DEFAULT_TRANSFORMER_SELECTION_CONFIG: TransformerSelectionConfig = {
  enabledAnchors: TRANSFORMER_RESIZE_ANCHORS,
  rotateEnabled: false,
  keepRatio: false,
  borderEnabled: true,
};

export const MOVE_ONLY_TRANSFORMER_SELECTION_CONFIG: TransformerSelectionConfig = {
  enabledAnchors: [],
  rotateEnabled: false,
  keepRatio: false,
  borderEnabled: true,
};

// In absolute stage coordinates, rotation in radians.
export type TransformerBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

type Page = { width: number; height: number };

type Point = { x: number; y: number };

// As a fraction of the box's width and height from its origin: top left is (0, 0), bottom right is (1, 1).
type Corner = { u: number; v: number };

/**
 * Konva rotates a node about its origin, `(x, y)` less any `offset`. Content
 * groups set no offset, so their origin, and so the pivot, is the top left
 * corner, matching `positionX`/`positionY` in the content meta. The box the
 * transformer hands to `boundBoxFunc` is built the same way.
 */
const getBoxCorner = (box: TransformerBox, corner: Corner): Point => {
  const cos = Math.cos(box.rotation);
  const sin = Math.sin(box.rotation);

  const localX = corner.u * box.width;
  const localY = corner.v * box.height;

  return {
    x: box.x + localX * cos - localY * sin,
    y: box.y + localX * sin + localY * cos,
  };
};

// The corner which moved least is the one the resize is anchored on.
const getFixedCorner = (oldBox: TransformerBox, newBox: TransformerBox): Corner => {
  const corners: Corner[] = [
    { u: 0, v: 0 },
    { u: 1, v: 0 },
    { u: 0, v: 1 },
    { u: 1, v: 1 },
  ];

  let fixedCorner = corners[0];
  let smallestMovement = Number.POSITIVE_INFINITY;

  for (const corner of corners) {
    const before = getBoxCorner(oldBox, corner);
    const after = getBoxCorner(newBox, corner);

    const movement = Math.hypot(after.x - before.x, after.y - before.y);

    if (movement < smallestMovement) {
      smallestMovement = movement;
      fixedCorner = corner;
    }
  }

  return fixedCorner;
};

const buildBoxFromCorner = (
  box: TransformerBox,
  fixedCorner: Corner,
  fixedPoint: Point,
  width: number,
  height: number,
): TransformerBox => {
  const cos = Math.cos(box.rotation);
  const sin = Math.sin(box.rotation);

  const localX = -fixedCorner.u * width;
  const localY = -fixedCorner.v * height;

  return {
    ...box,
    x: fixedPoint.x + localX * cos - localY * sin,
    y: fixedPoint.y + localX * sin + localY * cos,
    width,
    height,
  };
};

/**
 * For a rotated box each local axis moves both page axes at once, so the limit
 * along an axis is the tightest of the four page edges.
 */
const getAxisLimits = (box: TransformerBox, fixedCorner: Corner, fixedPoint: Point, page: Page) => {
  const cos = Math.cos(box.rotation);
  const sin = Math.sin(box.rotation);

  const directionX = { x: cos * (fixedCorner.u === 0 ? 1 : -1), y: sin * (fixedCorner.u === 0 ? 1 : -1) };
  const directionY = { x: -sin * (fixedCorner.v === 0 ? 1 : -1), y: cos * (fixedCorner.v === 0 ? 1 : -1) };

  // The largest `t` such that `point + t * direction` stays on the page.
  const limitAlong = (point: Point, direction: Point) => {
    let limit = Number.POSITIVE_INFINITY;

    if (direction.x > 0) {
      limit = Math.min(limit, (page.width - point.x) / direction.x);
    } else if (direction.x < 0) {
      limit = Math.min(limit, -point.x / direction.x);
    }

    if (direction.y > 0) {
      limit = Math.min(limit, (page.height - point.y) / direction.y);
    } else if (direction.y < 0) {
      limit = Math.min(limit, -point.y / direction.y);
    }

    return limit;
  };

  return {
    directionX,
    directionY,
    limitAlong,
  };
};

/**
 * Each axis is clamped on its own: an anchor dragged past the page stops that
 * axis at the edge while the other still follows the mouse.
 */
export const boundTransformerBoxToPage = (
  oldBox: TransformerBox,
  newBox: TransformerBox,
  page: Page,
): TransformerBox => {
  if (newBox.width <= 0 || newBox.height <= 0) {
    return newBox;
  }

  const fixedCorner = getFixedCorner(oldBox, newBox);
  const fixedPoint = getBoxCorner(newBox, fixedCorner);

  const { directionX, directionY, limitAlong } = getAxisLimits(newBox, fixedCorner, fixedPoint, page);

  // Shrink the width first, then the height from the corner the width now
  // ends at, so the far corner is checked against the clamped width.
  const width = Math.min(newBox.width, limitAlong(fixedPoint, directionX));

  const widthEnd = { x: fixedPoint.x + directionX.x * width, y: fixedPoint.y + directionX.y * width };

  const height = Math.min(newBox.height, limitAlong(fixedPoint, directionY), limitAlong(widthEnd, directionY));

  return buildBoxFromCorner(newBox, fixedCorner, fixedPoint, width, height);
};

/**
 * Clamping one axis on its own would break the ratio, and Konva would undo
 * the clamp on the next mouse move anyway since it recomputes the box from
 * the anchor's distance to the opposite corner. Instead the box is scaled
 * down about its fixed corner until every corner is on the page.
 */
export const boundTransformerBoxToPageKeepingRatio = (
  oldBox: TransformerBox,
  newBox: TransformerBox,
  page: Page,
): TransformerBox => {
  if (newBox.width <= 0 || newBox.height <= 0) {
    return newBox;
  }

  const fixedCorner = getFixedCorner(oldBox, newBox);
  const fixedPoint = getBoxCorner(newBox, fixedCorner);

  const { directionX, directionY, limitAlong } = getAxisLimits(newBox, fixedCorner, fixedPoint, page);

  // The diagonal from the fixed corner to the opposite one, in page units
  // per unit of scale, which every corner must stay inside the page along.
  const diagonal = {
    x: directionX.x * newBox.width + directionY.x * newBox.height,
    y: directionX.y * newBox.width + directionY.y * newBox.height,
  };

  const scale = Math.min(
    1,
    limitAlong(fixedPoint, directionX) / newBox.width,
    limitAlong(fixedPoint, directionY) / newBox.height,
    limitAlong(fixedPoint, diagonal),
  );

  if (scale === 1) {
    return newBox;
  }

  return buildBoxFromCorner(newBox, fixedCorner, fixedPoint, newBox.width * scale, newBox.height * scale);
};
