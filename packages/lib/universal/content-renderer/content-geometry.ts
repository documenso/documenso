import type Konva from 'konva';

import type { TContentLineMeta, TEnvelopeContentMeta } from '../../types/envelope-content-meta';
import {
  CONTENT_TYPE_DATA_CONTENT_TYPE,
  EnvelopeContentType,
  isRotatableContentMeta,
  normalizeContentRotation,
  ROTATABLE_CONTENT_TYPES,
} from '../../types/envelope-content-meta';
import { toPercentage } from '../../utils/geometry';
import type { TransformerSelectionConfig } from '../konva/transformer';
import {
  DEFAULT_TRANSFORMER_SELECTION_CONFIG,
  MOVE_ONLY_TRANSFORMER_SELECTION_CONFIG,
  TRANSFORMER_CORNER_ANCHORS,
  TRANSFORMER_RESIZE_ANCHORS,
} from '../konva/transformer';
import { CONTENT_BOUNDS_NODE_NAME, CONTENT_LINE_NODE_NAME } from './content-renderer';

/**
 * A plain snapshot of a content group's transform, in unscaled page units.
 *
 * Decoupled from Konva so the geometry resolvers below are pure and testable.
 */
export type ContentGroupTransform = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;

  /**
   * The unscaled size of the content's bounds node. Zero for lines.
   */
  boxWidth: number;
  boxHeight: number;

  /**
   * The line points relative to the group origin. Null for box contents.
   */
  linePoints: number[] | null;
};

/**
 * The gesture which produced a transform, which determines what is written
 * back to the metadata.
 *
 * - `drag`: Only the position changed.
 * - `transform`: The size and/or rotation changed via the transformer.
 */
export type ContentGesture = 'drag' | 'transform';

/**
 * Read the transform snapshot of a rendered content group.
 *
 * This is the only Konva touching step of the write back, so it stays thin.
 */
export const readContentGroupTransform = (contentGroup: Konva.Group): ContentGroupTransform => {
  const contentLine = contentGroup.findOne(`.${CONTENT_LINE_NODE_NAME}`);
  const boundsNode = contentGroup.findOne(`.${CONTENT_BOUNDS_NODE_NAME}`);

  let boxWidth = 0;
  let boxHeight = 0;

  if (boundsNode) {
    boxWidth = boundsNode.width();
    boxHeight = boundsNode.height();
  } else if (!contentLine) {
    // Fall back to the group's own unrotated bounds if a renderer has not
    // tagged a bounds node.
    const clientRect = contentGroup.getClientRect({ skipStroke: true, skipShadow: true, relativeTo: contentGroup });

    boxWidth = clientRect.width;
    boxHeight = clientRect.height;
  }

  return {
    x: contentGroup.x(),
    y: contentGroup.y(),
    scaleX: contentGroup.scaleX(),
    scaleY: contentGroup.scaleY(),
    rotation: contentGroup.rotation(),
    boxWidth,
    boxHeight,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    linePoints: contentLine ? [...(contentLine as Konva.Line).points()] : null,
  };
};

/**
 * Resolve the line metadata from a line's group position and relative points.
 *
 * Shared by body drags and endpoint anchor drags.
 */
export const resolveLineMetaFromPoints = (
  meta: TContentLineMeta,
  groupX: number,
  groupY: number,
  points: number[],
  pageWidth: number,
  pageHeight: number,
): TContentLineMeta => {
  return {
    ...meta,
    x1: toPercentage(groupX + points[0], pageWidth),
    y1: toPercentage(groupY + points[1], pageHeight),
    x2: toPercentage(groupX + points[2], pageWidth),
    y2: toPercentage(groupY + points[3], pageHeight),
  };
};

/**
 * Resolve the metadata of a content from its rendered group transform after
 * a gesture.
 *
 * - Lines translate their endpoints by the group position.
 * - Box drags only update the position. The group position is the rotation
 *   origin (the unrotated top left), which is exactly what the metadata
 *   stores, so drags are rotation safe.
 * - Box transforms update the size and rotation as well. The transformer
 *   resizes by scaling the group within its own rotated frame, so the
 *   unrotated box is the bounds size multiplied by the group scale.
 */
export const resolveContentMetaFromTransform = (
  meta: TEnvelopeContentMeta,
  transform: ContentGroupTransform,
  gesture: ContentGesture,
  pageWidth: number,
  pageHeight: number,
): TEnvelopeContentMeta => {
  // If the content is a line, we need to update the line points.
  if (meta.type === EnvelopeContentType.LINE) {
    if (!transform.linePoints) {
      return meta;
    }

    return resolveLineMetaFromPoints(meta, transform.x, transform.y, transform.linePoints, pageWidth, pageHeight);
  }

  const positionX = toPercentage(transform.x, pageWidth);
  const positionY = toPercentage(transform.y, pageHeight);

  // If the gesture is a drag, we only need to update the position.
  if (gesture === 'drag') {
    return {
      ...meta,
      positionX,
      positionY,
    };
  }

  // If the gesture is a transform, we need to update the position and size.
  const resizedMeta = {
    ...meta,
    positionX,
    positionY,
    width: toPercentage(transform.boxWidth * transform.scaleX, pageWidth),
    height: toPercentage(transform.boxHeight * transform.scaleY, pageHeight),
  };

  // Only rotatable contents carry a rotation, the transformer never rotates
  // the others so any rotation on the transform is ignored for them.
  if (!isRotatableContentMeta(resizedMeta)) {
    return resizedMeta;
  }

  return {
    ...resizedMeta,
    rotation: normalizeContentRotation(transform.rotation),
  };
};

type ContentTransformerConfigOptions = {
  /**
   * Whether the single selected content has an image attached.
   */
  hasImage?: boolean;
};

/**
 * Resolve the transformer configuration for a selection of contents.
 *
 * - Lines are move only, since their endpoints are edited via dedicated
 *   anchors rather than resizing. A single selected line also hides the
 *   border, since its endpoint anchors already mark the selection and a
 *   bounding box around a diagonal line reads as noise. Multi-selections keep
 *   the border so the group as a whole is visibly selected.
 * - Rotation is only available for a single selected content of a rotatable
 *   type. Multi-selections rotate around a shared pivot, which cannot be
 *   represented in the per content metadata.
 * - A single image content with an image attached resizes from the
 *   corners with its ratio locked, since its box always has the image's
 *   shape. Placeholders resize freely until an image is attached.
 */
export const getContentTransformerConfig = (
  types: (EnvelopeContentType | undefined)[],
  { hasImage = false }: ContentTransformerConfigOptions = {},
): TransformerSelectionConfig => {
  if (types.includes(EnvelopeContentType.LINE)) {
    return {
      ...MOVE_ONLY_TRANSFORMER_SELECTION_CONFIG,
      borderEnabled: types.length !== 1,
    };
  }

  const [type] = types;

  const isSingleRotatable = types.length === 1 && type !== undefined && ROTATABLE_CONTENT_TYPES.has(type);

  const isSingleImageWithImage = isSingleRotatable && CONTENT_TYPE_DATA_CONTENT_TYPE[type] !== undefined && hasImage;

  return {
    ...DEFAULT_TRANSFORMER_SELECTION_CONFIG,
    rotateEnabled: isSingleRotatable,
    keepRatio: isSingleImageWithImage,
    enabledAnchors: isSingleImageWithImage ? TRANSFORMER_CORNER_ANCHORS : TRANSFORMER_RESIZE_ANCHORS,
  };
};
