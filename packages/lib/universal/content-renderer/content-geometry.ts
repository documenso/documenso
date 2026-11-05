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

export type ContentGroupTransform = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;

  boxWidth: number;
  boxHeight: number;

  linePoints: number[] | null;
};

export type ContentGesture = 'drag' | 'transform';

export const readContentGroupTransform = (contentGroup: Konva.Group): ContentGroupTransform => {
  const contentLine = contentGroup.findOne(`.${CONTENT_LINE_NODE_NAME}`);
  const boundsNode = contentGroup.findOne(`.${CONTENT_BOUNDS_NODE_NAME}`);

  let boxWidth = 0;
  let boxHeight = 0;

  if (boundsNode) {
    boxWidth = boundsNode.width();
    boxHeight = boundsNode.height();
  } else if (!contentLine) {
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
 * The group position is the rotation origin (the unrotated top left), which is
 * exactly what the metadata stores, so drags are rotation safe. The transformer
 * resizes by scaling the group within its own rotated frame, so the unrotated
 * box is the bounds size multiplied by the group scale.
 */
export const resolveContentMetaFromTransform = (
  meta: TEnvelopeContentMeta,
  transform: ContentGroupTransform,
  gesture: ContentGesture,
  pageWidth: number,
  pageHeight: number,
): TEnvelopeContentMeta => {
  if (meta.type === EnvelopeContentType.LINE) {
    if (!transform.linePoints) {
      return meta;
    }

    return resolveLineMetaFromPoints(meta, transform.x, transform.y, transform.linePoints, pageWidth, pageHeight);
  }

  const positionX = toPercentage(transform.x, pageWidth);
  const positionY = toPercentage(transform.y, pageHeight);

  if (gesture === 'drag') {
    return {
      ...meta,
      positionX,
      positionY,
    };
  }

  const resizedMeta = {
    ...meta,
    positionX,
    positionY,
    width: toPercentage(transform.boxWidth * transform.scaleX, pageWidth),
    height: toPercentage(transform.boxHeight * transform.scaleY, pageHeight),
  };

  if (!isRotatableContentMeta(resizedMeta)) {
    return resizedMeta;
  }

  return {
    ...resizedMeta,
    rotation: normalizeContentRotation(transform.rotation),
  };
};

type ContentTransformerConfigOptions = {
  hasImage?: boolean;
};

/**
 * - Lines are move only, since their endpoints are edited via dedicated
 *   anchors. A single selected line also hides the border, since its endpoint
 *   anchors already mark the selection.
 * - Multi-selections rotate around a shared pivot, which cannot be represented
 *   in the per content metadata, so rotation is single selection only.
 * - An attached image resizes from the corners with its ratio locked so it is
 *   never stretched. Placeholders resize freely until an image is attached.
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
