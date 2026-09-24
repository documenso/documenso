import { useLatestRef } from '@documenso/lib/client-only/hooks/use-latest-ref';
import type { TransformerSelectionConfig } from '@documenso/lib/universal/konva/transformer';
import {
  boundTransformerBoxToPage,
  DEFAULT_TRANSFORMER_SELECTION_CONFIG,
} from '@documenso/lib/universal/konva/transformer';
import { getRecipientColorStyles } from '@documenso/ui/lib/recipient-colors';
import Konva from 'konva';
import type { Transformer } from 'konva/lib/shapes/Transformer';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { EnvelopeCanvasSelection, EnvelopeCanvasSelectionKind } from './envelope-canvas-types';
import { ENVELOPE_CANVAS_GROUP_NAMES } from './envelope-canvas-types';

/**
 * A stable empty array so consumers of a kind which is not selected keep a
 * stable dependency and don't re-render on every selection change.
 */
const EMPTY_GROUPS: Konva.Group[] = [];

/** How far past a resize handle you can still grab it, in screen pixels. */
const TRANSFORMER_ANCHOR_HIT_STROKE_PX = 24;

type SelectOptions = {
  isAuto?: boolean;
};

type UseEnvelopeCanvasSelectionOptions = {
  /**
   * Resolve the transformer configuration for a selection.
   */
  getTransformerConfig: (kind: EnvelopeCanvasSelectionKind, groups: Konva.Group[]) => TransformerSelectionConfig;

  /**
   * Called synchronously whenever the selection changes, so the editor
   * selection can be kept in sync without a frame of drift.
   */
  onChange: (selection: EnvelopeCanvasSelection) => void;
};

/**
 * The single canvas selection shared by fields and contents, along with the
 * Konva transformer which acts upon it.
 *
 * The exposed functions are stable and read their options through refs, so
 * they are safe to call from Konva handlers bound once at stage creation.
 */
export const useEnvelopeCanvasSelection = ({ getTransformerConfig, onChange }: UseEnvelopeCanvasSelectionOptions) => {
  const transformerRef = useRef<Transformer | null>(null);

  const [selection, setSelectionState] = useState<EnvelopeCanvasSelection>(null);

  /**
   * Whether a selected item is being dragged, resized or rotated.
   */
  const [isTransforming, setIsTransforming] = useState(false);

  const getTransformerConfigRef = useLatestRef(getTransformerConfig);
  const onChangeRef = useLatestRef(onChange);

  const applyTransformerConfig = useCallback((transformer: Transformer, currentSelection: EnvelopeCanvasSelection) => {
    const config = currentSelection
      ? getTransformerConfigRef.current(currentSelection.kind, currentSelection.groups)
      : DEFAULT_TRANSFORMER_SELECTION_CONFIG;

    transformer.enabledAnchors(config.enabledAnchors);
    transformer.rotateEnabled(config.rotateEnabled);
    transformer.keepRatio(config.keepRatio);
    transformer.borderEnabled(config.borderEnabled);
  }, []);

  const selectionRef = useLatestRef(selection);

  /**
   * Re-resolve the transformer configuration for the current selection, for
   * when the selected items change in a way which affects it (e.g. an image
   * being attached to a selected content) without the selection changing.
   */
  const refreshTransformerConfig = useCallback(() => {
    const transformer = transformerRef.current;

    if (!transformer) {
      return;
    }

    applyTransformerConfig(transformer, selectionRef.current);
    transformer.forceUpdate();
  }, [applyTransformerConfig]);

  const applySelection = useCallback((nextSelection: EnvelopeCanvasSelection) => {
    const transformer = transformerRef.current;

    if (transformer) {
      // Configure the transformer before assigning nodes, since assigning
      // nodes triggers an update using the current configuration.
      applyTransformerConfig(transformer, nextSelection);
      transformer.nodes(nextSelection?.groups ?? []);
    }

    if (nextSelection?.groups.length === 1) {
      nextSelection.groups[0].moveToTop();
    }

    setSelectionState(nextSelection);
    onChangeRef.current(nextSelection);
  }, []);

  const select = useCallback(
    (kind: EnvelopeCanvasSelectionKind, nodes: Konva.Node[], options?: SelectOptions) => {
      const groupName = ENVELOPE_CANVAS_GROUP_NAMES[kind];

      const groups = nodes.filter(
        (node): node is Konva.Group =>
          node instanceof Konva.Group &&
          node.hasName(groupName) &&
          Boolean(node.getStage()) &&
          Boolean(node.getParent()),
      );

      applySelection(groups.length > 0 ? { kind, groups, isAuto: Boolean(options?.isAuto) } : null);
    },
    [applySelection],
  );

  /**
   * Toggle a node in or out of the current selection (shift-click semantics).
   *
   * Nodes of a different kind than the toggled node are dropped, since only
   * one kind can be selected at a time.
   */
  const toggle = useCallback(
    (kind: EnvelopeCanvasSelectionKind, node: Konva.Node) => {
      const currentNodes = transformerRef.current?.nodes() ?? [];
      const isAlreadySelected = currentNodes.includes(node);

      select(kind, isAlreadySelected ? currentNodes.filter((current) => current !== node) : [...currentNodes, node]);
    },
    [select],
  );

  const clear = useCallback(() => {
    applySelection(null);
  }, [applySelection]);

  const isSelected = useCallback((node: Konva.Node) => {
    return (transformerRef.current?.nodes() ?? []).includes(node);
  }, []);

  /**
   * Re-resolve the selection against the groups currently on the layer.
   *
   * The stage is destroyed and rebuilt whenever the page is rescaled (e.g.
   * zooming), which leaves the selection holding detached nodes: the handles
   * disappear, the action bar positions itself from an empty rect, and the
   * next reconcile drops the selection altogether. Groups keep their render
   * ID across the rebuild, so the equivalent new groups are selected instead.
   */
  const reattachSelection = useCallback(
    (layer: Konva.Layer) => {
      const currentSelection = selectionRef.current;

      if (!currentSelection) {
        return;
      }

      const selectedIds = new Set(currentSelection.groups.map((group) => group.id()));

      const groups = layer
        .find(`.${ENVELOPE_CANVAS_GROUP_NAMES[currentSelection.kind]}`)
        .filter((group) => selectedIds.has(group.id()));

      select(currentSelection.kind, groups, { isAuto: currentSelection.isAuto });
    },
    [select],
  );

  /**
   * Create the transformer on a layer. Called once when the page canvas is
   * created, and again whenever the stage is recreated.
   */
  const attach = useCallback((layer: Konva.Layer) => {
    // Match the brand green used for the first recipient's fields rather than
    // Konva's default blue.
    const selectionColor = getRecipientColorStyles('green').baseRing;

    const transformer = new Konva.Transformer({
      ...DEFAULT_TRANSFORMER_SELECTION_CONFIG,
      rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
      rotationSnapTolerance: 5,
      keepRatio: false,
      borderStroke: selectionColor,
      anchorStroke: selectionColor,
      shouldOverdrawWholeArea: true,
      ignoreStroke: true,
      flipEnabled: false,
      anchorStyleFunc: (anchor) => {
        // The stage is scaled to the page, so the hit area is divided by that
        // scale to stay a constant size on screen.
        const stageScale = layer.getStage()?.scaleX() ?? 1;

        anchor.hitStrokeWidth(TRANSFORMER_ANCHOR_HIT_STROKE_PX / stageScale);
      },
      boundBoxFunc: (oldBox, newBox) => {
        // Boxes are in absolute stage coordinates and the stage is the page,
        // so pin the resize to the stage's own size.
        const stage = layer.getStage();

        const bounded = stage
          ? boundTransformerBoxToPage(newBox, { width: stage.width(), height: stage.height() })
          : newBox;

        // Enforce minimum size
        if (bounded.width < 30 || bounded.height < 20) {
          return oldBox;
        }

        return bounded;
      },
    });

    layer.add(transformer);

    // Konva fires transform events (resize and rotate) directly on the
    // transformer and its nodes without bubbling, so they cannot be observed
    // on the stage.
    transformer.on('transformstart', () => setIsTransforming(true));
    transformer.on('transformend', () => setIsTransforming(false));

    transformerRef.current = transformer;

    return transformer;
  }, []);

  const fieldGroups = useMemo(() => (selection?.kind === 'field' ? selection.groups : EMPTY_GROUPS), [selection]);

  const contentGroups = useMemo(() => (selection?.kind === 'content' ? selection.groups : EMPTY_GROUPS), [selection]);

  return {
    selection,
    fieldGroups,
    contentGroups,
    isTransforming,
    setIsTransforming,
    attach,
    reattachSelection,
    select,
    toggle,
    clear,
    isSelected,
    refreshTransformerConfig,
  };
};

export type EnvelopeCanvasSelectionApi = ReturnType<typeof useEnvelopeCanvasSelection>;
