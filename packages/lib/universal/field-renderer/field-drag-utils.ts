// ABOUTME: Shared drag infrastructure for checkbox and radio item groups.
// ABOUTME: Provides the OnItemDragEnd type and setupItemDrag helper used by both field renderers.
import type Konva from 'konva';

export type OnItemDragEnd = (params: {
  itemIndex: number;
  offsetX: number;
  offsetY: number;
}) => void;

type SetupItemDragParams = {
  itemGroup: Konva.Group;
  index: number;
  currentOffsetX: number;
  currentOffsetY: number;
  clampOffset: (offsetX: number, offsetY: number) => { offsetX: number; offsetY: number };
  onItemDragEnd: OnItemDragEnd;
};

export const setupItemDrag = ({
  itemGroup,
  index,
  currentOffsetX,
  currentOffsetY,
  clampOffset,
  onItemDragEnd,
}: SetupItemDragParams): void => {
  itemGroup.draggable(true);

  itemGroup.on('dragstart', (e) => {
    if (!e.evt?.shiftKey) {
      itemGroup.stopDrag();
      return;
    }
    e.cancelBubble = true;
  });

  itemGroup.on('dragend', () => {
    const dx = itemGroup.x();
    const dy = itemGroup.y();

    if (dx === 0 && dy === 0) {
      return;
    }

    const rawOffsetX = currentOffsetX + dx;
    const rawOffsetY = currentOffsetY + dy;

    const { offsetX, offsetY } = clampOffset(rawOffsetX, rawOffsetY);

    itemGroup.position({ x: 0, y: 0 });

    onItemDragEnd({ itemIndex: index, offsetX, offsetY });
  });
};
