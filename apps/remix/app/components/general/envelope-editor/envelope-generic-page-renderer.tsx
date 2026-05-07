import { useEffect, useMemo } from 'react';

import { useLingui } from '@lingui/react/macro';
import { DocumentStatus, type Recipient, SigningStatus } from '@prisma/client';
import type Konva from 'konva';

import { usePageRenderer } from '@documenso/lib/client-only/hooks/use-page-renderer';
import {
  type PageRenderData,
  useCurrentEnvelopeRender,
} from '@documenso/lib/client-only/providers/envelope-render-provider';
import type { TEnvelope } from '@documenso/lib/types/envelope';
import { renderField } from '@documenso/lib/universal/field-renderer/render-field';
import { getClientSideFieldTranslations } from '@documenso/lib/utils/fields';
import { EnvelopeRecipientFieldTooltip } from '@documenso/ui/components/document/envelope-recipient-field-tooltip';

type GenericLocalField = TEnvelope['fields'][number] & {
  recipient: Pick<Recipient, 'id' | 'name' | 'email' | 'signingStatus'>;
};

export const EnvelopeGenericPageRenderer = ({ pageData }: { pageData: PageRenderData }) => {
  const { i18n } = useLingui();

  const {
    envelopeStatus,
    currentEnvelopeItem,
    fields,
    signatures,
    recipients,
    getRecipientColorKey,
    setRenderError,
    overrideSettings,
  } = useCurrentEnvelopeRender();

  const signaturesByFieldId = useMemo(() => {
    return new Map(signatures.map((signature) => [signature.fieldId, signature]));
  }, [signatures]);

  const { stage, pageLayer, konvaContainer, unscaledViewport } = usePageRenderer(
    ({ stage, pageLayer }) => {
      createPageCanvas(stage, pageLayer);
    },
    pageData,
  );

  const { scale, pageNumber } = pageData;

  const localPageFields = useMemo((): GenericLocalField[] => {
    if (envelopeStatus === DocumentStatus.COMPLETED) {
      return [];
    }

    return fields
      .filter(
        (field) => field.page === pageNumber && field.envelopeItemId === currentEnvelopeItem?.id,
      )
      .map((field) => {
        const recipient = recipients.find((recipient) => recipient.id === field.recipientId);

        if (!recipient) {
          throw new Error(`Recipient not found for field ${field.id}`);
        }

        const isInserted = recipient.signingStatus === SigningStatus.SIGNED && field.inserted;

        return {
          ...field,
          inserted: isInserted,
          customText: isInserted ? field.customText : '',
          recipient,
        };
      })
      .filter(
        ({ inserted, fieldMeta, recipient }) =>
          (recipient.signingStatus === SigningStatus.SIGNED ? inserted : true) ||
          fieldMeta?.readOnly,
      );
  }, [fields, pageNumber, currentEnvelopeItem?.id, recipients, envelopeStatus]);

  const unsafeRenderFieldOnLayer = (field: GenericLocalField) => {
    if (!pageLayer.current) {
      console.error('Layer not loaded yet');
      return;
    }

    const fieldTranslations = getClientSideFieldTranslations(i18n);

    // Look up an inserted signature for this field. If we don't have one (e.g.
    // the signatures haven't been loaded, or the field hasn't been signed yet)
    // fall back to a placeholder so the field still renders something.
    const insertedSignature = signaturesByFieldId.get(field.id);

    const signature = insertedSignature ?? {
      signatureImageAsBase64: '',
      typedSignature: fieldTranslations.SIGNATURE,
    };

    renderField({
      scale,
      pageLayer: pageLayer.current,
      field: {
        renderId: field.id.toString(),
        ...field,
        width: Number(field.width),
        height: Number(field.height),
        positionX: Number(field.positionX),
        positionY: Number(field.positionY),
        fieldMeta: field.fieldMeta,
        signature,
      },
      translations: fieldTranslations,
      pageWidth: unscaledViewport.width,
      pageHeight: unscaledViewport.height,
      color: getRecipientColorKey(field.recipientId),
      editable: false,
      mode: overrideSettings?.mode ?? 'edit',
    });
  };

  const renderFieldOnLayer = (field: GenericLocalField) => {
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
  }, [localPageFields, signaturesByFieldId]);

  if (!currentEnvelopeItem) {
    return null;
  }

  return (
    <>
      {overrideSettings?.showRecipientTooltip &&
        pageData.imageLoadingState === 'loaded' &&
        localPageFields.map((field) => (
          <EnvelopeRecipientFieldTooltip
            key={field.id}
            field={field}
            showFieldStatus={overrideSettings?.showRecipientSigningStatus}
            showRecipientTooltip={overrideSettings?.showRecipientTooltip}
          />
        ))}

      {/* The element Konva will inject it's canvas into. */}
      <div className="konva-container absolute inset-0 z-10 w-full" ref={konvaContainer}></div>
    </>
  );
};
