import { useEffect, useMemo } from 'react';

import { useLingui } from '@lingui/react/macro';
import type Konva from 'konva';

import { usePageRenderer } from '@documenso/lib/client-only/hooks/use-page-renderer';
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import type { TEnvelope } from '@documenso/lib/types/envelope';
import { renderField } from '@documenso/lib/universal/field-renderer/render-field';
import { getClientSideFieldTranslations } from '@documenso/lib/utils/fields';

export default function EnvelopeGenericPageRenderer() {
  const { i18n } = useLingui();

  const { currentEnvelopeItem, fields, getRecipientColorKey, setRenderError } =
    useCurrentEnvelopeRender();

  const {
    stage,
    pageLayer,
    canvasElement,
    konvaContainer,
    pageContext,
    scaledViewport,
    unscaledViewport,
  } = usePageRenderer(({ stage, pageLayer }) => {
    createPageCanvas(stage, pageLayer);
  });

  const { _className, scale } = pageContext;

  const localPageFields = useMemo(
    () =>
      fields.filter(
        (field) =>
          field.page === pageContext.pageNumber && field.envelopeItemId === currentEnvelopeItem?.id,
      ),
    [fields, pageContext.pageNumber],
  );

  const unsafeRenderFieldOnLayer = (field: TEnvelope['fields'][number]) => {
    if (!pageLayer.current) {
      console.error('Layer not loaded yet');
      return;
    }

    renderField({
      scale,
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
      translations: getClientSideFieldTranslations(i18n),
      pageWidth: unscaledViewport.width,
      pageHeight: unscaledViewport.height,
      color: getRecipientColorKey(field.recipientId),
      editable: false,
      mode: 'sign',
    });
  };

  const renderFieldOnLayer = (field: TEnvelope['fields'][number]) => {
    try {
      unsafeRenderFieldOnLayer(field);
    } catch (err) {
      console.error(err);
      setRenderError(true);
    }
  };

  /**
   * Initialize the Konva page canvas and all fields and interactions.
   */
  const createPageCanvas = (_currentStage: Konva.Stage, currentPageLayer: Konva.Layer) => {
    // Render the fields.
    for (const field of localPageFields) {
      renderFieldOnLayer(field);
    }

    currentPageLayer.batchDraw();
  };

  /**
   * Render fields when they are added or removed
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
        group.destroy();
      }
    });

    // If it exists, rerender.
    localPageFields.forEach((field) => {
      renderFieldOnLayer(field);
    });

    pageLayer.current.batchDraw();
  }, [localPageFields]);

  if (!currentEnvelopeItem) {
    return null;
  }

  return (
    <div
      className="relative w-full"
      key={`${currentEnvelopeItem.id}-renderer-${pageContext.pageNumber}`}
    >
      {/* The element Konva will inject it's canvas into. */}
      <div className="konva-container absolute inset-0 z-10 w-full" ref={konvaContainer}></div>

      {/* Canvas the PDF will be rendered on. */}
      <canvas
        className={`${_className}__canvas z-0`}
        ref={canvasElement}
        height={scaledViewport.height}
        width={scaledViewport.width}
      />
    </div>
  );
}
