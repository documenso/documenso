import Konva from 'konva';

import { AppError } from '../../errors/app-error';
import type { TBoxContentMeta } from '../../types/envelope-content-meta';
import { getContentRotation, isBoxContentMeta } from '../../types/envelope-content-meta';
import type { Rect } from '../../utils/geometry';
import { KONVA_TRANSPARENT_FILL } from '../konva/constants';
import type { ContentToRender, RenderContentOptions } from './content-renderer';
import {
  CONTENT_BOUNDS_NODE_NAME,
  CONTENT_GROUP_NODE_NAME,
  calculateContentBoxGeometry,
  KONVA_CONTENT_HOVER_OUTLINE_COLOR,
} from './content-renderer';

/**
 * Where a content's group sits on the page, in pixels. The group rotates
 * about this origin.
 */
type ContentGroupPosition = {
  x: number;
  y: number;
  rotation: number;
};

/**
 * Draws a box content type's own nodes inside the group, after the shared
 * frame (group, position, hover outline) has been set up.
 *
 * `meta` is any box content; the renderer narrows it to its own type via
 * `assertContentMetaType`.
 */
type RenderBoxContentChildren = (context: {
  contentGroup: Konva.Group;
  meta: TBoxContentMeta;

  /**
   * The content box in pixels. The group sits at its origin, so children are
   * positioned relative to `(0, 0)` with its width and height.
   */
  geometry: Rect;
}) => void;

/**
 * Render a box content: compute the box in pixels, upsert the group at it,
 * draw the type's own nodes via `renderChildren`, and bind the hover outline
 * around the box.
 */
export const renderBoxContent = (
  content: ContentToRender,
  options: RenderContentOptions,
  renderChildren: RenderBoxContentChildren,
): Konva.Group => {
  const meta = content.contentMeta;

  if (!isBoxContentMeta(meta)) {
    throw new AppError('INVALID_CONTENT_TYPE', {
      message: `Expected a box content but got ${meta.type}`,
    });
  }

  const geometry = calculateContentBoxGeometry(meta, options.pageWidth, options.pageHeight);

  const contentGroup = upsertContentGroup(content, options, {
    x: geometry.x,
    y: geometry.y,
    rotation: getContentRotation(meta),
  });

  renderChildren({ contentGroup, meta, geometry });

  createContentHoverInteraction(contentGroup, content, options, geometry.width, geometry.height);

  return contentGroup;
};

/**
 * Upsert the Konva group of a content at the given position.
 *
 * If the content type has changed since the last render, all children are
 * destroyed so the new type renders fresh.
 */
export const upsertContentGroup = (
  content: ContentToRender,
  options: RenderContentOptions,
  position: ContentGroupPosition,
): Konva.Group => {
  const { pageLayer, editable, pageWidth, pageHeight, scale } = options;

  const contentGroup: Konva.Group =
    pageLayer.findOne(`#${content.renderId}`) ||
    new Konva.Group({
      id: content.renderId,
      name: CONTENT_GROUP_NODE_NAME,
    });

  if (contentGroup.getAttr('contentType') !== content.contentMeta.type) {
    contentGroup.destroyChildren();
    contentGroup.setAttr('contentType', content.contentMeta.type);
  }

  contentGroup.setAttrs({
    x: position.x,
    y: position.y,
    rotation: position.rotation,
    scaleX: 1,
    scaleY: 1,
    draggable: editable ?? false,
    dragBoundFunc: (pos) => createContentDragBound(contentGroup, pos, pageWidth, pageHeight, scale),
  } satisfies Partial<Konva.GroupConfig>);

  return contentGroup;
};

/**
 * Clamp a dragged content group so its visual bounds stay within the page.
 *
 * Unlike fields, a content group's origin is not necessarily its visual top
 * left, e.g. rotated contents pivot around their origin and lines extend from
 * it in any direction. So rather than clamping the origin directly, the
 * group's axis aligned client rect is measured and the drag position shifted
 * by however far that rect would overflow the page.
 *
 * Positions and rects are in scaled stage coordinates.
 */
const createContentDragBound = (
  contentGroup: Konva.Group,
  pos: { x: number; y: number },
  pageWidth: number,
  pageHeight: number,
  scale: number,
) => {
  const currentPosition = contentGroup.absolutePosition();
  const rect = contentGroup.getClientRect({ skipStroke: true, skipShadow: true });

  // The offset from the group origin to its visual bounds is stable during a
  // drag, so the rect at the proposed position is the current rect shifted by
  // the proposed movement.
  const proposedLeft = rect.x + (pos.x - currentPosition.x);
  const proposedTop = rect.y + (pos.y - currentPosition.y);
  const proposedRight = proposedLeft + rect.width;
  const proposedBottom = proposedTop + rect.height;

  const scaledPageWidth = pageWidth * scale;
  const scaledPageHeight = pageHeight * scale;

  let correctionX = 0;
  let correctionY = 0;

  if (proposedLeft < 0) {
    correctionX = -proposedLeft;
  } else if (proposedRight > scaledPageWidth) {
    correctionX = scaledPageWidth - proposedRight;
  }

  if (proposedTop < 0) {
    correctionY = -proposedTop;
  } else if (proposedBottom > scaledPageHeight) {
    correctionY = scaledPageHeight - proposedBottom;
  }

  return {
    x: pos.x + correctionX,
    y: pos.y + correctionY,
  };
};

/**
 * Upsert a child node within a content group by ID.
 */
export const upsertContentGroupChild = <T extends Konva.Group | Konva.Shape>(
  contentGroup: Konva.Group,
  id: string,
  create: () => T,
): T => {
  const existingNode = contentGroup.findOne(`#${id}`);

  if (existingNode) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return existingNode as T;
  }

  const node = create();

  node.id(id);
  contentGroup.add(node);

  return node;
};

/**
 * Upsert an invisible rectangle spanning the content bounds so the whole area
 * is clickable/draggable, since shapes like text do not fill their box.
 *
 * Konva hit detection ignores alpha, so a transparent fill still registers.
 *
 * The hit rect spans the full bounds by definition, so it also serves as the
 * content's bounds node.
 */
export const upsertContentHitRect = (
  contentGroup: Konva.Group,
  content: ContentToRender,
  width: number,
  height: number,
): Konva.Rect => {
  const hitRect = upsertContentGroupChild(
    contentGroup,
    `${content.renderId}-hit-rect`,
    () =>
      new Konva.Rect({
        name: `content-hit-rect ${CONTENT_BOUNDS_NODE_NAME}`,
        fill: KONVA_TRANSPARENT_FILL,
      }),
  );

  hitRect.setAttrs({
    x: 0,
    y: 0,
    width,
    height,
  } satisfies Partial<Konva.RectConfig>);

  hitRect.moveToBottom();

  return hitRect;
};

/**
 * Show a dashed outline around a box content while hovered, providing edit
 * mode feedback since contents have no permanent outline like field rects.
 */
export const createContentHoverInteraction = (
  contentGroup: Konva.Group,
  content: ContentToRender,
  options: RenderContentOptions,
  width: number,
  height: number,
) => {
  const outline = upsertContentGroupChild(
    contentGroup,
    `${content.renderId}-hover-outline`,
    () =>
      new Konva.Rect({
        name: 'content-hover-outline',
        listening: false,
        visible: false,
        strokeWidth: 1,
        dash: [4, 3],
        strokeScaleEnabled: false,
      }),
  );

  outline.setAttrs({
    x: 0,
    y: 0,
    width,
    height,
    stroke: options.hoverOutlineColor ?? KONVA_CONTENT_HOVER_OUTLINE_COLOR,
  } satisfies Partial<Konva.RectConfig>);

  bindContentHoverOutline(contentGroup, outline, options);
};

/**
 * Show a dashed trace along a line content while hovered. A bounding box
 * would not follow a diagonal line, so the outline is the line itself.
 */
export const createLineContentHoverInteraction = (
  contentGroup: Konva.Group,
  content: ContentToRender,
  options: RenderContentOptions,
  points: number[],
  strokeWidth: number,
) => {
  const outline = upsertContentGroupChild<Konva.Line>(
    contentGroup,
    `${content.renderId}-hover-outline`,
    () =>
      new Konva.Line({
        name: 'content-hover-outline',
        listening: false,
        visible: false,
        dash: [4, 3],
        lineCap: 'round',
        strokeScaleEnabled: false,
      }),
  );

  outline.setAttrs({
    points,
    // Slightly wider than the line so the trace is visible around it.
    strokeWidth: strokeWidth + 2,
    stroke: options.hoverOutlineColor ?? KONVA_CONTENT_HOVER_OUTLINE_COLOR,
  } satisfies Partial<Konva.LineConfig>);

  bindContentHoverOutline(contentGroup, outline, options);
};

/**
 * Toggle an outline node with the group's hover while the content is
 * editable, keeping it hidden otherwise.
 */
const bindContentHoverOutline = (contentGroup: Konva.Group, outline: Konva.Shape, options: RenderContentOptions) => {
  outline.moveToTop();

  contentGroup.off('mouseenter.contentHover');
  contentGroup.off('mouseleave.contentHover');

  if (!options.editable || options.mode !== 'edit') {
    outline.visible(false);
    return;
  }

  contentGroup.on('mouseenter.contentHover', () => {
    outline.visible(true);
    contentGroup.getLayer()?.batchDraw();
  });

  contentGroup.on('mouseleave.contentHover', () => {
    outline.visible(false);
    contentGroup.getLayer()?.batchDraw();
  });
};
