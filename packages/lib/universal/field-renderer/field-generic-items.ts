import Konva from 'konva';

import {
  DEFAULT_RECT_BACKGROUND,
  RECIPIENT_COLOR_STYLES,
} from '@documenso/ui/lib/recipient-colors';

import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';
import { calculateFieldPosition } from './field-renderer';

export const upsertFieldGroup = (
  field: FieldToRender,
  options: RenderFieldElementOptions,
): Konva.Group => {
  const { pageWidth, pageHeight, pageLayer, editable } = options;

  const { fieldX, fieldY, fieldWidth, fieldHeight } = calculateFieldPosition(
    field,
    pageWidth,
    pageHeight,
  );

  const fieldGroup: Konva.Group =
    pageLayer.findOne(`#${field.renderId}`) ||
    new Konva.Group({
      id: field.renderId,
      name: 'field-group',
    });

  fieldGroup.setAttrs({
    scaleX: 1,
    scaleY: 1,
    x: fieldX,
    y: fieldY,
    draggable: editable,
    dragBoundFunc: (pos) => {
      const newX = Math.max(0, Math.min(pageWidth - fieldWidth, pos.x));
      const newY = Math.max(0, Math.min(pageHeight - fieldHeight, pos.y));
      return { x: newX, y: newY };
    },
  } satisfies Partial<Konva.GroupConfig>);

  return fieldGroup;
};

export const upsertFieldRect = (
  field: FieldToRender,
  options: RenderFieldElementOptions,
): Konva.Rect => {
  const { pageWidth, pageHeight, mode, pageLayer, color } = options;

  const { fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);

  const fieldRect: Konva.Rect =
    pageLayer.findOne(`#${field.renderId}-rect`) ||
    new Konva.Rect({
      id: `${field.renderId}-rect`,
      name: 'field-rect',
    });

  fieldRect.setAttrs({
    width: fieldWidth,
    height: fieldHeight,
    fill: DEFAULT_RECT_BACKGROUND,
    stroke: color ? RECIPIENT_COLOR_STYLES[color].baseRing : '#e5e7eb',
    strokeWidth: 2,
    cornerRadius: 2,
    strokeScaleEnabled: false,
    visible: mode !== 'export',
  } satisfies Partial<Konva.RectConfig>);

  return fieldRect;
};

export const createSpinner = ({
  fieldWidth,
  fieldHeight,
}: {
  fieldWidth: number;
  fieldHeight: number;
}) => {
  const loadingGroup = new Konva.Group({
    name: 'loading-spinner-group',
  });

  const rect = new Konva.Rect({
    x: 4,
    y: 4,
    width: fieldWidth - 8,
    height: fieldHeight - 8,
    fill: 'white',
    opacity: 1,
  });

  const spinner = new Konva.Arc({
    x: fieldWidth / 2,
    y: fieldHeight / 2,
    innerRadius: fieldWidth / 10,
    outerRadius: fieldHeight / 10,
    angle: 270,
    rotation: 0,
    fill: 'rgba(122, 195, 85, 1)',
    lineCap: 'round',
  });

  rect.moveToTop();
  spinner.moveToTop();

  loadingGroup.add(rect);
  loadingGroup.add(spinner);

  const anim = new Konva.Animation((frame) => {
    spinner.rotate(180 * (frame.timeDiff / 500));
  });

  anim.start();

  return loadingGroup;
};
