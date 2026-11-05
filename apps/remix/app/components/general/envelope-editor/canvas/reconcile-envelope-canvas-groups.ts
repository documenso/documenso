import Konva from 'konva';

import type { EnvelopeCanvasSelectionKind } from './envelope-canvas-types';

type ReconcileEnvelopeCanvasGroupsOptions<T> = {
  layer: Konva.Layer;

  groupName: string;

  items: T[];
  getRenderId: (item: T) => string;
  render: (item: T) => void;
};

export const reconcileEnvelopeCanvasGroups = <T>({
  layer,
  groupName,
  items,
  getRenderId,
  render,
}: ReconcileEnvelopeCanvasGroupsOptions<T>) => {
  const renderIds = new Set(items.map(getRenderId));

  layer.find('Group').forEach((group) => {
    if (group.name() === groupName && !renderIds.has(group.id())) {
      group.destroy();
    }
  });

  for (const item of items) {
    render(item);
  }
};

export const getLiveEnvelopeCanvasGroups = (groups: Konva.Group[], isOnPage: (renderId: string) => boolean) => {
  return groups.filter((group) => Boolean(group.getStage()) && Boolean(group.getParent()) && isOnPage(group.id()));
};

type SyncEditorSelectionToCanvasOptions = {
  layer: Konva.Layer;
  kind: EnvelopeCanvasSelectionKind;

  editorFormId: string | null;
  isOnPage: (renderId: string) => boolean;

  selectedGroups: Konva.Group[];

  select: (kind: EnvelopeCanvasSelectionKind, nodes: Konva.Node[]) => void;
  clear: () => void;
};

/**
 * Creating an item marks it as selected within the editor, so this makes a
 * newly placed item show its transformer immediately without a second click.
 *
 * Must run after the groups have been rendered so the item's group exists.
 */
export const syncEditorSelectionToCanvas = ({
  layer,
  kind,
  editorFormId,
  isOnPage,
  selectedGroups,
  select,
  clear,
}: SyncEditorSelectionToCanvasOptions) => {
  const isSingleSelection = selectedGroups.length === 1;

  if (editorFormId && isOnPage(editorFormId)) {
    const isAlreadySelected = isSingleSelection && selectedGroups[0].id() === editorFormId;

    if (isAlreadySelected) {
      return;
    }

    const groupToSelect = layer.findOne(`#${editorFormId}`);

    if (groupToSelect instanceof Konva.Group) {
      select(kind, [groupToSelect]);
    }

    return;
  }

  if (editorFormId === null && isSingleSelection) {
    clear();
  }
};
