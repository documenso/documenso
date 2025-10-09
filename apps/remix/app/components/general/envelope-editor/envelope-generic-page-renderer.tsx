import { useEffect, useMemo, useRef } from 'react';

import { useLingui } from '@lingui/react/macro';
import Konva from 'konva';
import type { Layer } from 'konva/lib/Layer';
import type { RenderParameters } from 'pdfjs-dist/types/src/display/api';
import { usePageContext } from 'react-pdf';

import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import type { TEnvelope } from '@documenso/lib/types/envelope';
import { renderField } from '@documenso/lib/universal/field-renderer/render-field';

export default function EnvelopeGenericPageRenderer() {
  const pageContext = usePageContext();

  if (!pageContext) {
    throw new Error('Unable to find Page context.');
  }

  const { _className, page, rotate, scale } = pageContext;

  if (!page) {
    throw new Error('Attempted to render page canvas, but no page was specified.');
  }

  const { t } = useLingui();
  const { currentEnvelopeItem, fields } = useCurrentEnvelopeRender();

  const canvasElement = useRef<HTMLCanvasElement>(null);
  const konvaContainer = useRef<HTMLDivElement>(null);

  const stage = useRef<Konva.Stage | null>(null);
  const pageLayer = useRef<Layer | null>(null);

  const viewport = useMemo(
    () => page.getViewport({ scale, rotation: rotate }),
    [page, rotate, scale],
  );

  const localPageFields = useMemo(
    () =>
      fields.filter(
        (field) =>
          field.page === pageContext.pageNumber && field.envelopeItemId === currentEnvelopeItem?.id,
      ),
    [fields, pageContext.pageNumber],
  );

  // Custom renderer from Konva examples.
  useEffect(
    function drawPageOnCanvas() {
      if (!page) {
        return;
      }

      const { current: canvas } = canvasElement;
      const { current: container } = konvaContainer;

      if (!canvas || !container) {
        return;
      }

      const renderContext: RenderParameters = {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        canvasContext: canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D,
        viewport,
      };

      const cancellable = page.render(renderContext);
      const runningTask = cancellable;

      cancellable.promise.catch(() => {
        // Intentionally empty
      });

      void cancellable.promise.then(() => {
        createPageCanvas(container);
      });

      return () => {
        runningTask.cancel();
      };
    },
    [page, viewport],
  );

  const renderFieldOnLayer = (field: TEnvelope['fields'][number]) => {
    if (!pageLayer.current) {
      console.error('Layer not loaded yet');
      return;
    }

    renderField({
      pageLayer: pageLayer.current,
      field: {
        renderId: field.id.toString(),
        ...field,
        customText: '',
        width: Number(field.width),
        height: Number(field.height),
        positionX: Number(field.positionX),
        positionY: Number(field.positionY),
        inserted: false,
        fieldMeta: field.fieldMeta,
      },
      pageWidth: viewport.width,
      pageHeight: viewport.height,
      // color: getRecipientColorKey(field.recipientId),
      color: 'purple', // Todo
      editable: false,
      mode: 'sign',
    });
  };

  /**
   * Create the initial Konva page canvas and initialize all fields and interactions.
   */
  const createPageCanvas = (container: HTMLDivElement) => {
    stage.current = new Konva.Stage({
      container,
      width: viewport.width,
      height: viewport.height,
    });

    // Create the main layer for interactive elements.
    pageLayer.current = new Konva.Layer();
    stage.current?.add(pageLayer.current);

    // Render the fields.
    for (const field of localPageFields) {
      renderFieldOnLayer(field);
    }

    pageLayer.current.batchDraw();
  };

  /**
   * Render fields when they are added or removed from the localFields.
   */
  useEffect(() => {
    if (!pageLayer.current || !stage.current) {
      return;
    }

    // If doesn't exist in localFields, destroy it since it's been deleted.
    pageLayer.current.find('Group').forEach((group) => {
      if (
        group.name() === 'field-group' &&
        !localPageFields.some((field) => field.id.toString() === group.id())
      ) {
        console.log('Field removed, removing from canvas');
        group.destroy();
      }
    });

    // If it exists, rerender.
    localPageFields.forEach((field) => {
      console.log('Field created/updated, rendering on canvas');
      renderFieldOnLayer(field);
    });

    pageLayer.current.batchDraw();
  }, [localPageFields]);

  if (!currentEnvelopeItem) {
    return null;
  }

  return (
    <div className="relative" key={`${currentEnvelopeItem.id}-renderer-${pageContext.pageNumber}`}>
      <div className="konva-container absolute inset-0 z-10" ref={konvaContainer}></div>

      <canvas
        className={`${_className}__canvas z-0`}
        height={viewport.height}
        ref={canvasElement}
        width={viewport.width}
      />
    </div>
  );
}
