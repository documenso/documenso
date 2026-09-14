import type { TLocalContent } from '@documenso/lib/client-only/hooks/use-editor-contents';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { EnvelopeContentType } from '@documenso/lib/types/envelope-content-meta';
import { resolveLineMetaFromPoints } from '@documenso/lib/universal/content-renderer/content-geometry';
import {
  CONTENT_LINE_NODE_NAME,
  calculateContentLineGeometry,
} from '@documenso/lib/universal/content-renderer/content-renderer';
import { getRecipientColorStyles } from '@documenso/ui/lib/recipient-colors';
import Konva from 'konva';
import { useEffect, useMemo, useState } from 'react';

import type { EnvelopeCanvas } from './envelope-canvas-types';
import type { EnvelopeCanvasSelectionApi } from './use-envelope-canvas-selection';

const LINE_ANCHOR_NODE_NAME = 'content-line-anchor';

/**
 * The screen size radius of the line endpoint anchors.
 */
const LINE_ANCHOR_RADIUS = 5;

type UseEnvelopeCanvasLineAnchorsOptions = {
  canvas: EnvelopeCanvas;
  selection: EnvelopeCanvasSelectionApi;
  isEditable: boolean;
  localPageContents: TLocalContent[];
};

/**
 * Draggable endpoint anchors for a single selected line content.
 *
 * Lines are move-only within the shared transformer, so the endpoints are
 * edited through these custom anchors instead. Anchors are hidden while the
 * line body itself is being dragged, and recreated afterwards.
 */
export const useEnvelopeCanvasLineAnchors = ({
  canvas,
  selection,
  isEditable,
  localPageContents,
}: UseEnvelopeCanvasLineAnchorsOptions) => {
  const { editorContents } = useCurrentEnvelopeEditor();

  const { pageLayer, scale, unscaledViewport, scaledViewport } = canvas;
  const { contentGroups: selectedGroups, isTransforming } = selection;

  /**
   * Whether an anchor is being dragged.
   *
   * Tracked separately from the selection's `isTransforming` since that would
   * destroy the anchors mid drag (this effect depends on it), whereas this only
   * needs to hide the floating action bar.
   */
  const [isDragging, setIsDragging] = useState(false);

  /**
   * The selected line content, if exactly one line content is selected.
   */
  const selectedLineContent = useMemo((): TLocalContent | null => {
    if (selectedGroups.length !== 1) {
      return null;
    }

    const content = editorContents.getContentByFormId(selectedGroups[0].id());

    return content?.contentMeta.type === EnvelopeContentType.LINE ? content : null;
    // Depends on the contents themselves rather than the getter, which is
    // stable, so the anchors follow the line as its coordinates change.
  }, [selectedGroups, localPageContents, editorContents.getContentByFormId]);

  useEffect(() => {
    const layer = pageLayer.current;

    if (!layer) {
      return;
    }

    const destroyAnchors = () => {
      for (const node of layer.find(`.${LINE_ANCHOR_NODE_NAME}`)) {
        node.destroy();
      }
    };

    destroyAnchors();

    const contentMeta = selectedLineContent?.contentMeta;

    if (!selectedLineContent || contentMeta?.type !== EnvelopeContentType.LINE || !isEditable || isTransforming) {
      layer.batchDraw();
      return;
    }

    const geometry = calculateContentLineGeometry(contentMeta, unscaledViewport.width, unscaledViewport.height);

    const findLineNodes = () => {
      const lineGroup = layer.findOne(`#${selectedLineContent.formId}`);

      if (!(lineGroup instanceof Konva.Group)) {
        return null;
      }

      const contentLine = lineGroup.findOne(`.${CONTENT_LINE_NODE_NAME}`);

      if (!(contentLine instanceof Konva.Line)) {
        return null;
      }

      return { lineGroup, contentLine };
    };

    const endpoints = [
      { pointIndex: 0, x: geometry.x + geometry.points[0], y: geometry.y + geometry.points[1] },
      { pointIndex: 2, x: geometry.x + geometry.points[2], y: geometry.y + geometry.points[3] },
    ];

    for (const endpoint of endpoints) {
      const anchor = new Konva.Circle({
        name: LINE_ANCHOR_NODE_NAME,
        x: endpoint.x,
        y: endpoint.y,
        // Compensate for the stage scale so the anchors keep a constant
        // screen size, mirroring the transformer anchors.
        radius: LINE_ANCHOR_RADIUS / scale,
        fill: '#ffffff',
        // Matches the transformer anchors, themed to the brand green.
        stroke: getRecipientColorStyles('green').baseRing,
        strokeWidth: 1.5,
        strokeScaleEnabled: false,
        draggable: true,
        // Keep the anchor within the page bounds. Positions are in scaled
        // stage coordinates.
        dragBoundFunc: (pos) => ({
          x: Math.max(0, Math.min(scaledViewport.width, pos.x)),
          y: Math.max(0, Math.min(scaledViewport.height, pos.y)),
        }),
      });

      anchor.on('dragstart', () => setIsDragging(true));

      // Live preview while dragging the anchor.
      anchor.on('dragmove', () => {
        const lineNodes = findLineNodes();

        if (!lineNodes) {
          return;
        }

        const points = [...lineNodes.contentLine.points()];

        points[endpoint.pointIndex] = anchor.x() - lineNodes.lineGroup.x();
        points[endpoint.pointIndex + 1] = anchor.y() - lineNodes.lineGroup.y();

        lineNodes.contentLine.points(points);

        layer.batchDraw();
      });

      // Write the new endpoint positions back into the metadata. The
      // reconcile effect re-renders the normalized geometry and recreates
      // the anchors.
      anchor.on('dragend', () => {
        setIsDragging(false);

        const lineNodes = findLineNodes();

        if (!lineNodes) {
          return;
        }

        editorContents.updateContentByFormId(selectedLineContent.formId, {
          contentMeta: resolveLineMetaFromPoints(
            contentMeta,
            lineNodes.lineGroup.x(),
            lineNodes.lineGroup.y(),
            lineNodes.contentLine.points(),
            unscaledViewport.width,
            unscaledViewport.height,
          ),
        });
      });

      layer.add(anchor);
      anchor.moveToTop();
    }

    layer.batchDraw();

    return () => {
      destroyAnchors();
    };
  }, [selectedLineContent, isEditable, isTransforming, localPageContents, scale, scaledViewport]);

  return { isDragging };
};
