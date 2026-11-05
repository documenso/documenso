import { useLatestRef } from '@documenso/lib/client-only/hooks/use-latest-ref';
import type { TransformerSelectionConfig } from '@documenso/lib/universal/konva/transformer';
import {
  boundTransformerBoxToPage,
  boundTransformerBoxToPageKeepingRatio,
  DEFAULT_TRANSFORMER_SELECTION_CONFIG,
} from '@documenso/lib/universal/konva/transformer';
import { getRecipientColorStyles } from '@documenso/ui/lib/recipient-colors';
import Konva from 'konva';
import type { Transformer } from 'konva/lib/shapes/Transformer';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { EnvelopeCanvasSelection, EnvelopeCanvasSelectionKind } from './envelope-canvas-types';
import { ENVELOPE_CANVAS_GROUP_NAMES } from './envelope-canvas-types';

// Stable so consumers of an unselected kind don't re-render on every selection change.
const EMPTY_GROUPS: Konva.Group[] = [];

const TRANSFORMER_ANCHOR_HIT_STROKE_PX = 24;

type UseEnvelopeCanvasSelectionOptions = {
  getTransformerConfig: (kind: EnvelopeCanvasSelectionKind, groups: Konva.Group[]) => TransformerSelectionConfig;

  onChange: (selection: EnvelopeCanvasSelection) => void;
};

/**
 * The exposed functions are stable and read their options through refs, so
 * they are safe to call from Konva handlers bound once at stage creation.
 */
export const useEnvelopeCanvasSelection = ({ getTransformerConfig, onChange }: UseEnvelopeCanvasSelectionOptions) => {
  const transformerRef = useRef<Transformer | null>(null);

  const [selection, setSelectionState] = useState<EnvelopeCanvasSelection>(null);

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
   * The configuration can change without the selection changing, e.g. an image
   * attached to the selected content locks its ratio.
   *
   * The handles straddle the selected item's edges, so any item stacked above
   * the transformer hides part of them and takes their clicks. Rendering
   * appends new items on top and the contents stacking raises every content,
   * so each reconcile calls this afterwards.
   */
  const refreshTransformer = useCallback(() => {
    const transformer = transformerRef.current;

    if (!transformer) {
      return;
    }

    applyTransformerConfig(transformer, selectionRef.current);
    transformer.moveToTop();
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

    // Above the item just raised, so its handles stay visible and clickable.
    transformer?.moveToTop();

    setSelectionState(nextSelection);
    onChangeRef.current(nextSelection);
  }, []);

  const select = useCallback(
    (kind: EnvelopeCanvasSelectionKind, nodes: Konva.Node[]) => {
      const groupName = ENVELOPE_CANVAS_GROUP_NAMES[kind];

      const groups = nodes.filter(
        (node): node is Konva.Group =>
          node instanceof Konva.Group &&
          node.hasName(groupName) &&
          Boolean(node.getStage()) &&
          Boolean(node.getParent()),
      );

      applySelection(groups.length > 0 ? { kind, groups } : null);
    },
    [applySelection],
  );

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

      select(currentSelection.kind, groups);
    },
    [select],
  );

  const attach = useCallback((layer: Konva.Layer) => {
    const selectionColor = getRecipientColorStyles('green').baseRing;

    const transformer = new Konva.Transformer({
      ...DEFAULT_TRANSFORMER_SELECTION_CONFIG,
      rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
      rotationSnapTolerance: 5,
      keepRatio: false,
      borderStroke: selectionColor,
      anchorStroke: selectionColor,
      ignoreStroke: true,
      flipEnabled: false,
      anchorStyleFunc: (anchor) => {
        // The stage is scaled to the page, so the hit area is divided by that
        // scale to stay a constant size on screen.
        const stageScale = layer.getStage()?.scaleX() ?? 1;

        anchor.hitStrokeWidth(TRANSFORMER_ANCHOR_HIT_STROKE_PX / stageScale);
      },
      boundBoxFunc: (oldBox, newBox) => {
        // Boxes are in absolute stage coordinates and the stage is the page.
        const stage = layer.getStage();

        if (!stage) {
          return newBox;
        }

        const page = { width: stage.width(), height: stage.height() };

        // A ratio locked resize has to shrink both axes together, so it is
        // bounded about its fixed corner rather than edge by edge. Read via
        // the ref since the transformer is still being constructed here.
        const bounded = transformerRef.current?.keepRatio()
          ? boundTransformerBoxToPageKeepingRatio(oldBox, newBox, page)
          : boundTransformerBoxToPage(oldBox, newBox, page);

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
    refreshTransformer,
  };
};

export type EnvelopeCanvasSelectionApi = ReturnType<typeof useEnvelopeCanvasSelection>;
