import { useEffect, useMemo } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';
import {
  type Field,
  FieldType,
  type Recipient,
  RecipientRole,
  type Signature,
  SigningStatus,
} from '@prisma/client';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { match } from 'ts-pattern';

import { usePageRenderer } from '@documenso/lib/client-only/hooks/use-page-renderer';
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { DIRECT_TEMPLATE_RECIPIENT_EMAIL } from '@documenso/lib/constants/direct-templates';
import { isBase64Image } from '@documenso/lib/constants/signatures';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import type { TEnvelope } from '@documenso/lib/types/envelope';
import { ZFullFieldSchema } from '@documenso/lib/types/field';
import { createSpinner } from '@documenso/lib/universal/field-renderer/field-generic-items';
import { renderField } from '@documenso/lib/universal/field-renderer/render-field';
import { isFieldUnsignedAndRequired } from '@documenso/lib/utils/advanced-fields-helpers';
import { getClientSideFieldTranslations } from '@documenso/lib/utils/fields';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { EnvelopeRecipientFieldTooltip } from '@documenso/ui/components/document/envelope-recipient-field-tooltip';
import { EnvelopeFieldToolTip } from '@documenso/ui/components/field/envelope-field-tooltip';
import type { TRecipientColor } from '@documenso/ui/lib/recipient-colors';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useEmbedSigningContext } from '~/components/embed/embed-signing-context';
import { handleCheckboxFieldClick } from '~/utils/field-signing/checkbox-field';
import { handleDropdownFieldClick } from '~/utils/field-signing/dropdown-field';
import { handleEmailFieldClick } from '~/utils/field-signing/email-field';
import { handleInitialsFieldClick } from '~/utils/field-signing/initial-field';
import { handleNameFieldClick } from '~/utils/field-signing/name-field';
import { handleNumberFieldClick } from '~/utils/field-signing/number-field';
import { handleSignatureFieldClick } from '~/utils/field-signing/signature-field';
import { handleTextFieldClick } from '~/utils/field-signing/text-field';

import { useRequiredDocumentSigningAuthContext } from '../document-signing/document-signing-auth-provider';
import { useRequiredEnvelopeSigningContext } from '../document-signing/envelope-signing-provider';

type GenericLocalField = TEnvelope['fields'][number] & {
  recipient: Pick<Recipient, 'id' | 'name' | 'email' | 'signingStatus'>;
};

export default function EnvelopeSignerPageRenderer() {
  const { t, i18n } = useLingui();
  const { currentEnvelopeItem, setRenderError } = useCurrentEnvelopeRender();
  const { sessionData } = useOptionalSession();

  const { executeActionAuthProcedure } = useRequiredDocumentSigningAuthContext();
  const { toast } = useToast();

  const {
    envelopeData,
    recipient,
    recipientFields,
    recipientFieldsRemaining,
    showPendingFieldTooltip,
    signField: signFieldInternal,
    email,
    setEmail,
    fullName,
    setFullName,
    signature,
    setSignature,
    selectedAssistantRecipientFields,
    selectedAssistantRecipient,
    isDirectTemplate,
  } = useRequiredEnvelopeSigningContext();

  const { onFieldSigned, onFieldUnsigned } = useEmbedSigningContext() || {};

  const {
    stage,
    pageLayer,
    canvasElement,
    konvaContainer,
    pageContext,
    scaledViewport,
    unscaledViewport,
  } = usePageRenderer(({ stage, pageLayer }) => createPageCanvas(stage, pageLayer));

  const { _className, scale } = pageContext;

  const { envelope } = envelopeData;

  const localPageFields = useMemo(() => {
    let fieldsToRender = recipientFields;

    if (recipient.role === RecipientRole.ASSISTANT) {
      fieldsToRender = selectedAssistantRecipientFields;
    }

    return fieldsToRender.filter(
      (field) =>
        field.page === pageContext.pageNumber && field.envelopeItemId === currentEnvelopeItem?.id,
    );
  }, [recipientFields, selectedAssistantRecipientFields, pageContext.pageNumber]);

  /**
   * Returns fields that have been fully signed by other recipients for this specific
   * page.
   */
  const localPageOtherRecipientFields = useMemo((): GenericLocalField[] => {
    const signedRecipients = envelope.recipients.filter(
      (recipient) => recipient.signingStatus === SigningStatus.SIGNED,
    );

    return signedRecipients.flatMap((recipient) => {
      return recipient.fields
        .filter(
          (field) =>
            field.page === pageContext.pageNumber &&
            field.envelopeItemId === currentEnvelopeItem?.id &&
            (field.inserted || field.fieldMeta?.readOnly),
        )
        .map((field) => ({
          ...field,
          recipient: {
            id: recipient.id,
            name: recipient.name,
            email: recipient.email,
            signingStatus: recipient.signingStatus,
            role: recipient.role,
          },
        }));
    });
  }, [envelope.recipients, pageContext.pageNumber]);

  const unsafeRenderFieldOnLayer = (unparsedField: Field & { signature?: Signature | null }) => {
    if (!pageLayer.current) {
      console.error('Layer not loaded yet');
      return;
    }

    const fieldToRender = ZFullFieldSchema.parse(unparsedField);

    let color: TRecipientColor = 'green';

    if (fieldToRender.fieldMeta?.readOnly) {
      color = 'readOnly';
    } else if (showPendingFieldTooltip && isFieldUnsignedAndRequired(fieldToRender)) {
      color = 'orange';
    }

    const { fieldGroup } = renderField({
      scale,
      pageLayer: pageLayer.current,
      field: {
        renderId: fieldToRender.id.toString(),
        ...fieldToRender,
        width: Number(fieldToRender.width),
        height: Number(fieldToRender.height),
        positionX: Number(fieldToRender.positionX),
        positionY: Number(fieldToRender.positionY),
        signature: unparsedField.signature,
      },
      translations: getClientSideFieldTranslations(i18n),
      pageWidth: unscaledViewport.width,
      pageHeight: unscaledViewport.height,
      color,
      mode: 'sign',
    });

    const handleFieldGroupClick = (e: KonvaEventObject<Event>) => {
      const currentTarget = e.currentTarget as Konva.Group;
      const target = e.target as Konva.Shape;

      const { width: fieldWidth, height: fieldHeight } = fieldGroup.getClientRect();

      const foundField = localPageFields.find((f) => f.id === unparsedField.id);
      const foundLoadingGroup = currentTarget.findOne('.loading-spinner-group');

      if (!foundField || foundLoadingGroup || foundField.fieldMeta?.readOnly) {
        return;
      }

      let localEmail: string | null = email;
      let localFullName: string | null = fullName;
      let placeholderEmail: string | null = null;

      if (recipient.role === RecipientRole.ASSISTANT) {
        localEmail = selectedAssistantRecipient?.email || null;
        localFullName = selectedAssistantRecipient?.name || null;
      }

      // Allows us let the user set a different email than their current logged in email.
      if (isDirectTemplate) {
        placeholderEmail = sessionData?.user?.email || email || recipient.email;

        if (!placeholderEmail || placeholderEmail === DIRECT_TEMPLATE_RECIPIENT_EMAIL) {
          placeholderEmail = null;
        }
      }

      const loadingSpinnerGroup = createSpinner({
        fieldWidth: fieldWidth / scale,
        fieldHeight: fieldHeight / scale,
      });

      const parsedFoundField = ZFullFieldSchema.parse(foundField);

      match(parsedFoundField)
        /**
         * CHECKBOX FIELD.
         */
        .with({ type: FieldType.CHECKBOX }, (field) => {
          const clickedCheckboxIndex = Number(target.getAttr('internalCheckboxIndex'));

          if (Number.isNaN(clickedCheckboxIndex)) {
            return;
          }

          handleCheckboxFieldClick({ field, clickedCheckboxIndex })
            .then(async (payload) => {
              if (payload) {
                fieldGroup.add(loadingSpinnerGroup);
                await signField(field.id, payload);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * RADIO FIELD.
         */
        .with({ type: FieldType.RADIO }, (field) => {
          const selectedRadioIndex = Number(target.getAttr('internalRadioIndex'));
          const fieldCustomText = Number(field.customText);

          if (Number.isNaN(selectedRadioIndex)) {
            return;
          }

          fieldGroup.add(loadingSpinnerGroup);

          // Uncheck the value if it's already pressed.
          const value =
            field.inserted && selectedRadioIndex === fieldCustomText ? null : selectedRadioIndex;

          void signField(field.id, {
            type: FieldType.RADIO,
            value,
          }).finally(() => {
            loadingSpinnerGroup.destroy();
          });
        })
        /**
         * NUMBER FIELD.
         */
        .with({ type: FieldType.NUMBER }, (field) => {
          handleNumberFieldClick({ field, number: null })
            .then(async (payload) => {
              if (payload) {
                fieldGroup.add(loadingSpinnerGroup);
                await signField(field.id, payload);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * TEXT FIELD.
         */
        .with({ type: FieldType.TEXT }, (field) => {
          handleTextFieldClick({ field, text: null })
            .then(async (payload) => {
              if (payload) {
                fieldGroup.add(loadingSpinnerGroup);
                await signField(field.id, payload);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * EMAIL FIELD.
         */
        .with({ type: FieldType.EMAIL }, (field) => {
          handleEmailFieldClick({ field, email: localEmail, placeholderEmail })
            .then(async (payload) => {
              if (payload) {
                fieldGroup.add(loadingSpinnerGroup);
                await signField(field.id, payload);
              }

              if (payload?.value) {
                setEmail(payload.value);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * INITIALS FIELD.
         */
        .with({ type: FieldType.INITIALS }, (field) => {
          const initials = localFullName ? extractInitials(localFullName) : null;

          handleInitialsFieldClick({ field, initials })
            .then(async (payload) => {
              if (payload) {
                fieldGroup.add(loadingSpinnerGroup);
                await signField(field.id, payload);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * NAME FIELD.
         */
        .with({ type: FieldType.NAME }, (field) => {
          handleNameFieldClick({ field, name: localFullName })
            .then(async (payload) => {
              if (payload) {
                fieldGroup.add(loadingSpinnerGroup);
                await signField(field.id, payload);
              }

              if (payload?.value) {
                setFullName(payload.value);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * DROPDOWN FIELD.
         */
        .with({ type: FieldType.DROPDOWN }, (field) => {
          handleDropdownFieldClick({ field, text: null })
            .then(async (payload) => {
              if (payload) {
                fieldGroup.add(loadingSpinnerGroup);
                await signField(field.id, payload);
              }

              loadingSpinnerGroup.destroy();
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * DATE FIELD.
         */
        .with({ type: FieldType.DATE }, (field) => {
          fieldGroup.add(loadingSpinnerGroup);

          void signField(field.id, {
            type: FieldType.DATE,
            value: !field.inserted,
          }).finally(() => {
            loadingSpinnerGroup.destroy();
          });
        })
        /**
         * SIGNATURE FIELD.
         */
        .with({ type: FieldType.SIGNATURE }, (field) => {
          handleSignatureFieldClick({
            field,
            signature,
            typedSignatureEnabled: envelope.documentMeta.typedSignatureEnabled,
            uploadSignatureEnabled: envelope.documentMeta.uploadSignatureEnabled,
            drawSignatureEnabled: envelope.documentMeta.drawSignatureEnabled,
          })
            .then(async (payload) => {
              if (payload) {
                fieldGroup.add(loadingSpinnerGroup);

                if (payload.value) {
                  void executeActionAuthProcedure({
                    onReauthFormSubmit: async (authOptions) => {
                      await signField(field.id, payload, authOptions);

                      loadingSpinnerGroup.destroy();
                    },
                    actionTarget: field.type,
                  });

                  setSignature(payload.value);
                } else {
                  await signField(field.id, payload);
                }
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        .exhaustive();
    };

    fieldGroup.off('pointerdown');
    fieldGroup.on('pointerdown', handleFieldGroupClick);
  };

  const renderFieldOnLayer = (unparsedField: Field & { signature?: Signature | null }) => {
    try {
      unsafeRenderFieldOnLayer(unparsedField);
    } catch (err) {
      console.error(err);
      setRenderError(true);
    }
  };

  const renderFields = () => {
    if (!pageLayer.current) {
      console.error('Layer not loaded yet');
      return;
    }

    // Render current recipient fields.
    for (const field of localPageFields) {
      renderFieldOnLayer(field);
    }

    // Render other recipient signed and inserted fields.
    for (const field of localPageOtherRecipientFields) {
      try {
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
          },
          translations: getClientSideFieldTranslations(i18n),
          pageWidth: unscaledViewport.width,
          pageHeight: unscaledViewport.height,
          color: 'readOnly',
          editable: false,
          mode: 'sign',
        });
      } catch (err) {
        console.error('Unable to render one or more fields belonging to other recipients.');
        console.error(err);
      }
    }
  };

  const signField = async (
    fieldId: number,
    payload: TSignEnvelopeFieldValue,
    authOptions?: TRecipientActionAuth,
  ) => {
    try {
      const { inserted } = await signFieldInternal(fieldId, payload, authOptions);

      // ?: The two callbacks below are used within the embedding context
      if (inserted && onFieldSigned) {
        const value = payload.value ? JSON.stringify(payload.value) : undefined;
        const isBase64 = value ? isBase64Image(value) : undefined;

        onFieldSigned({ fieldId, value, isBase64 });
      }

      if (!inserted && onFieldUnsigned) {
        onFieldUnsigned({ fieldId });
      }
    } catch (err) {
      console.error(err);

      toast({
        title: t`Error`,
        description: t`An error occurred while signing the field.`,
        variant: 'destructive',
      });

      throw err;
    }
  };

  /**
   * Initialize the Konva page canvas and all fields and interactions.
   */
  const createPageCanvas = (currentStage: Konva.Stage, currentPageLayer: Konva.Layer) => {
    renderFields();
    currentPageLayer.batchDraw();
  };

  /**
   * Render fields when they are changed or inserted.
   */
  useEffect(() => {
    if (!pageLayer.current || !stage.current) {
      return;
    }

    renderFields();

    pageLayer.current.batchDraw();
  }, [localPageFields, showPendingFieldTooltip, fullName, signature, email]);

  /**
   * Rerender the whole page if the selected assistant recipient changes.
   */
  useEffect(() => {
    if (!pageLayer.current || !stage.current) {
      return;
    }

    // Rerender the whole page.
    pageLayer.current.destroyChildren();

    renderFields();

    pageLayer.current.batchDraw();
  }, [selectedAssistantRecipient]);

  if (!currentEnvelopeItem) {
    return null;
  }

  return (
    <div
      className="relative w-full"
      key={`${currentEnvelopeItem.id}-renderer-${pageContext.pageNumber}`}
    >
      {showPendingFieldTooltip &&
        recipientFieldsRemaining.length > 0 &&
        recipientFieldsRemaining[0]?.envelopeItemId === currentEnvelopeItem?.id &&
        recipientFieldsRemaining[0]?.page === pageContext.pageNumber && (
          <EnvelopeFieldToolTip
            key={recipientFieldsRemaining[0].id}
            field={recipientFieldsRemaining[0]}
            color="warning"
          >
            <Trans>Click to insert field</Trans>
          </EnvelopeFieldToolTip>
        )}

      {localPageOtherRecipientFields.map((field) => (
        <EnvelopeRecipientFieldTooltip
          key={field.id}
          field={field}
          showFieldStatus={true}
          showRecipientTooltip={true}
        />
      ))}

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
