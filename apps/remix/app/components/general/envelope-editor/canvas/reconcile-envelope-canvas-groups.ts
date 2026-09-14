import Konva from 'konva';

import type { EnvelopeCanvasSelectionKind } from './envelope-canvas-types';

type ReconcileEnvelopeCanvasGroupsOptions<T> = {
  layer: Konva.Layer;

  /**
   * The Konva group name of the items being reconciled.
   */
  groupName: string;

  items: T[];
  getRenderId: (item: T) => string;
  render: (item: T) => void;
};

/**
 * Sync a layer's groups of a given name with a list of items.
 *
 * Groups whose ID no longer matches an item are destroyed, then every item is
 * (re)rendered so existing groups pick up any changes.
 */
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

/**
 * Filter selected groups down to those which are still attached to the stage
 * and still correspond to an item on the page, e.g. after items are deleted
 * or the page is resynced.
 */
export const getLiveEnvelopeCanvasGroups = (groups: Konva.Group[], isOnPage: (renderId: string) => boolean) => {
  return groups.filter((group) => Boolean(group.getStage()) && Boolean(group.getParent()) && isOnPage(group.id()));
};

type MirrorEditorSelectionToCanvasOptions = {
  layer: Konva.Layer;
  kind: EnvelopeCanvasSelectionKind;

  /**
   * The form ID of the item selected within the editor, if any.
   */
  editorFormId: string | null;
  isOnPage: (renderId: string) => boolean;

  /**
   * The currently selected groups of this kind.
   */
  selectedGroups: Konva.Group[];

  select: (kind: EnvelopeCanvasSelectionKind, nodes: Konva.Node[], options?: { isAuto?: boolean }) => void;
  clear: () => void;

  /**
   * Whether a selection made by this mirror counts as automatic.
   */
  isAuto: boolean;
};

/**
 * Mirror the editor's single selected item onto the canvas selection.
 *
 * Creating an item marks it as selected within the editor, so this makes a
 * newly placed item show its transformer immediately without a second click.
 * It also clears the canvas selection when the editor selection is cleared,
 * so a stale transformer can't linger.
 *
 * Must run after the groups have been rendered so the item's group exists.
 */
export const mirrorEditorSelectionToCanvas = ({
  layer,
  kind,
  editorFormId,
  isOnPage,
  selectedGroups,
  select,
  clear,
  isAuto,
}: MirrorEditorSelectionToCanvasOptions) => {
  const isSingleSelection = selectedGroups.length === 1;

  if (editorFormId && isOnPage(editorFormId)) {
    const isAlreadySelected = isSingleSelection && selectedGroups[0].id() === editorFormId;

    if (isAlreadySelected) {
      return;
    }

    const groupToSelect = layer.findOne(`#${editorFormId}`);

    if (groupToSelect instanceof Konva.Group) {
      select(kind, [groupToSelect], { isAuto });
    }

    return;
  }

  if (editorFormId === null && isSingleSelection) {
    clear();
  }
};
