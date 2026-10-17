import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { usePageRenderer } from '@documenso/lib/client-only/hooks/use-page-renderer';
import {
  type PageRenderData,
  useCurrentEnvelopeRender,
} from '@documenso/lib/client-only/providers/envelope-render-provider';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { DIRECT_TEMPLATE_RECIPIENT_EMAIL } from '@documenso/lib/constants/direct-templates';
import { isBase64Image } from '@documenso/lib/constants/signatures';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import type { TEnvelope } from '@documenso/lib/types/envelope';
import { ZFullFieldSchema } from '@documenso/lib/types/field';
import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';
import {
  createFieldCanvasStyleCache,
  type FieldCanvasStyleCache,
} from '@documenso/lib/universal/field-renderer/field-canvas-style';
import {
  FIELD_SPINNER_NAME,
  type FieldGroupHighlightLevel,
  syncFieldGroupHighlight,
  syncFieldSpinner,
} from '@documenso/lib/universal/field-renderer/field-generic-items';
import { renderField } from '@documenso/lib/universal/field-renderer/render-field';
import { getClientSideFieldTranslations, parseCheckboxCustomText } from '@documenso/lib/utils/fields';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import type { SigningItem } from '@documenso/lib/utils/signing-items';
import type {
  TSignEnvelopeFieldValue,
  TSignEnvelopeFieldValues,
} from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { EnvelopeRecipientFieldTooltip } from '@documenso/ui/components/document/envelope-recipient-field-tooltip';
import { EnvelopeFieldGroupBar } from '@documenso/ui/components/field/envelope-field-group-bar';
import { EnvelopeFieldToolTip } from '@documenso/ui/components/field/envelope-field-tooltip';
import type { TRecipientColor } from '@documenso/ui/lib/recipient-colors';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { type Field, FieldType, type Recipient, RecipientRole, type Signature, SigningStatus } from '@prisma/client';
import { AnimatePresence } from 'framer-motion';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useEffect, useMemo, useRef } from 'react';
import { match } from 'ts-pattern';

import { useEmbedSigningContext } from '~/components/embed/embed-signing-context';
import { handleCheckboxFieldClick } from '~/utils/field-signing/checkbox-field';
import { handleDropdownFieldClick } from '~/utils/field-signing/dropdown-field';
import { handleEmailFieldClick } from '~/utils/field-signing/email-field';
import { handleInitialsFieldClick } from '~/utils/field-signing/initial-field';
import { handleNameFieldClick } from '~/utils/field-signing/name-field';
import { handleNumberFieldClick } from '~/utils/field-signing/number-field';
import { handleSignatureFieldClick } from '~/utils/field-signing/signature-field';
import { handleTextFieldClick } from '~/utils/field-signing/text-field';
import { scrollToSigningField } from '~/utils/scroll-to-signing-field';

import { useRequiredDocumentSigningAuthContext } from '../document-signing/document-signing-auth-provider';
import { useRequiredEnvelopeSigningContext } from '../document-signing/envelope-signing-provider';

type GenericLocalField = TEnvelope['fields'][number] & {
  recipient: Pick<Recipient, 'id' | 'name' | 'email' | 'signingStatus'>;
};

export const EnvelopeSignerPageRenderer = ({ pageData }: { pageData: PageRenderData }) => {
  const { t, i18n } = useLingui();
  const { currentEnvelopeItem, setCurrentEnvelopeItem, setRenderError } = useCurrentEnvelopeRender();
  const { sessionData } = useOptionalSession();

  const { executeActionAuthProcedure } = useRequiredDocumentSigningAuthContext();
  const { toast } = useToast();
  const analytics = useAnalytics();

  const {
    envelopeData,
    recipient,
    recipientFields,
    pendingRecipientSigningItems,
    signingFieldIds,
    groupPointerTarget,
    groupBarFieldId,
    groupHighlightFieldId,
    onGroupFieldPointer,
    onGroupBarPointer,
    getFieldGroupNavigation,
    navigateFieldGroup,
    showPendingFieldTooltip,
    signFields: signFieldsInternal,
    email: emailState,
    setEmail,
    fullName: fullNameState,
    setFullName,
    signature: signatureState,
    setSignature,
    selectedAssistantRecipientFields,
    selectedAssistantRecipient,
    isDirectTemplate,
  } = useRequiredEnvelopeSigningContext();

  // Note: We're using refs here due to the closure within the signField function.
  const fullName = useRef(fullNameState);
  const email = useRef(emailState);
  const signature = useRef(signatureState);

  useEffect(() => {
    fullName.current = fullNameState;
    email.current = emailState;
    signature.current = signatureState;
  }, [fullNameState, emailState, signatureState]);

  const cachedRenderFields = useRef<Map<number, Field & { signature?: Signature | null }>>(new Map());
  const prevShowPendingFieldTooltip = useRef(showPendingFieldTooltip);

  const { onFieldSigned, onFieldUnsigned, onSignatureChanged } = useEmbedSigningContext() || {};

  const { stage, pageLayer, konvaContainer, unscaledViewport } = usePageRenderer(
    ({ stage, pageLayer }) => createPageCanvas(stage, pageLayer),
    pageData,
  );

  const { scale, pageNumber } = pageData;

  const { envelope } = envelopeData;

  /**
   * Every field belonging to the recipient currently being signed for, across all pages.
   */
  const signableFields = useMemo(() => {
    if (recipient.role === RecipientRole.ASSISTANT) {
      return selectedAssistantRecipientFields;
    }

    return recipientFields;
  }, [recipient.role, recipientFields, selectedAssistantRecipientFields]);

  const localPageFields = useMemo(() => {
    return signableFields.filter(
      (field) => field.page === pageNumber && field.envelopeItemId === currentEnvelopeItem?.id,
    );
  }, [signableFields, pageNumber, currentEnvelopeItem?.id]);

  /**
   * IDs of every field belonging to a pending signing item, so each member of a pending
   * group is highlighted rather than just the first.
   */
  const pendingFieldIds = useMemo(
    () => new Set(pendingRecipientSigningItems.flatMap((item) => item.fields.map((field) => field.id))),
    [pendingRecipientSigningItems],
  );

  const nextPendingSigningItem = pendingRecipientSigningItems[0];

  /**
   * Fields on the signing page are green, orange while being pointed out as pending.
   */
  const getSigningFieldColor = (field: Pick<Field, 'id' | 'fieldMeta'>): TRecipientColor => {
    if (ZFieldMetaSchema.safeParse(field.fieldMeta).data?.readOnly) {
      return 'readOnly';
    }

    return showPendingFieldTooltip && pendingFieldIds.has(field.id) ? 'orange' : 'green';
  };

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
            field.page === pageNumber &&
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
  }, [envelope.recipients, pageNumber, currentEnvelopeItem?.id]);

  /**
   * The grouped field on this page whose navigation bar is shown, if any.
   */
  const groupBarField = useMemo(() => {
    const field = localPageFields.find((localField) => localField.id === groupBarFieldId);

    return field?.groupId ? field : null;
  }, [groupBarFieldId, localPageFields]);

  const groupBarNavigation = useMemo(
    () => (groupBarField ? getFieldGroupNavigation(groupBarField.id) : null),
    [groupBarField, getFieldGroupNavigation],
  );

  const onGroupBarNavigate = (direction: 'previous' | 'next') => {
    if (!groupBarField) {
      return;
    }

    const targetField = navigateFieldGroup(groupBarField.id, direction);

    if (!targetField) {
      return;
    }

    scrollToSigningField({
      field: targetField,
      currentEnvelopeItemId: currentEnvelopeItem?.id,
      setCurrentEnvelopeItem,
    });
  };

  /**
   * How strongly each field on this page is tinted as part of the highlighted group. The
   * focused field is tinted like a hovered field, unless the pointer is actually on it
   * in which case the canvas hover already does that.
   */
  const groupHighlightLevels = useMemo(() => {
    const levels = new Map<number, FieldGroupHighlightLevel>();

    if (groupHighlightFieldId === null) {
      return levels;
    }

    const navigation = getFieldGroupNavigation(groupHighlightFieldId);

    for (const field of navigation?.fields ?? []) {
      const isFocused = field.id === groupHighlightFieldId;
      const isUnderPointer = groupPointerTarget?.source === 'field' && groupPointerTarget.fieldId === field.id;

      if (isFocused && isUnderPointer) {
        continue;
      }

      levels.set(field.id, isFocused ? 'focused' : 'member');
    }

    return levels;
  }, [groupHighlightFieldId, groupPointerTarget, getFieldGroupNavigation]);

  // Read through a ref so the render path, which may run from a stale closure when the
  // stage is recreated, always paints the current highlight.
  const groupHighlightLevelsRef = useRef(groupHighlightLevels);
  groupHighlightLevelsRef.current = groupHighlightLevels;

  const unsafeRenderFieldOnLayer = (
    unparsedField: Field & { signature?: Signature | null },
    fieldCanvasStyleCache: FieldCanvasStyleCache,
  ) => {
    if (!pageLayer.current) {
      console.error('Layer not loaded yet');
      return;
    }

    const fieldToRender = ZFullFieldSchema.parse(unparsedField);

    const isValidating = showPendingFieldTooltip && pendingFieldIds.has(fieldToRender.id);

    const color = getSigningFieldColor(fieldToRender);

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
        isValidating,
        signature: unparsedField.signature,
      },
      translations: getClientSideFieldTranslations(i18n),
      pageWidth: unscaledViewport.width,
      pageHeight: unscaledViewport.height,
      color,
      mode: 'sign',
      fieldCanvasStyleCache,
    });

    syncFieldSpinner(fieldGroup, signingFieldIds.has(fieldToRender.id));
    syncFieldGroupHighlight(fieldGroup, groupHighlightLevelsRef.current.get(fieldToRender.id) ?? null);

    const handleFieldGroupClick = (e: KonvaEventObject<Event>) => {
      const currentTarget = e.currentTarget as Konva.Group;
      const target = e.target as Konva.Shape;

      const foundField = localPageFields.find((f) => f.id === unparsedField.id);
      const isSigning = currentTarget.findOne(`.${FIELD_SPINNER_NAME}`) !== undefined;

      if (!foundField || isSigning || foundField.fieldMeta?.readOnly) {
        return;
      }

      let localEmail: string | null = email.current;
      let localFullName: string | null = fullName.current;
      let placeholderEmail: string | null = null;

      if (recipient.role === RecipientRole.ASSISTANT) {
        localEmail = selectedAssistantRecipient?.email || null;
        localFullName = selectedAssistantRecipient?.name || null;
      }

      // Allows us let the user set a different email than their current logged in email.
      if (isDirectTemplate) {
        placeholderEmail = sessionData?.user?.email || email.current || recipient.email;

        if (!placeholderEmail || placeholderEmail === DIRECT_TEMPLATE_RECIPIENT_EMAIL) {
          placeholderEmail = null;
        }
      }

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

          void signFields(handleCheckboxFieldClick({ field, clickedCheckboxIndex }));
        })
        /**
         * RADIO FIELD.
         */
        .with({ type: FieldType.RADIO }, (field) => {
          const selectedRadioIndex = Number(target.getAttr('internalRadioIndex'));

          if (Number.isNaN(selectedRadioIndex)) {
            return;
          }

          // Uncheck the value if it's already pressed. Grouped radio members with no
          // selection are inserted with an empty value, so an explicit check is required.
          const hasSelectedValue = field.inserted && field.customText !== '';
          const isAlreadySelected = hasSelectedValue && selectedRadioIndex === Number(field.customText);

          const value = isAlreadySelected ? null : selectedRadioIndex;

          void signField(field.id, {
            type: FieldType.RADIO,
            value,
          });
        })
        /**
         * NUMBER FIELD.
         */
        .with({ type: FieldType.NUMBER }, (field) => {
          void handleNumberFieldClick({ field, number: null })
            .then(async (payload) => {
              if (payload) {
                await signField(field.id, payload);
              }
            })
            // Dialogs cover the canvas, so it never sees the pointer leave the field.
            .finally(() => onGroupFieldPointer(field.id, 'leave'));
        })
        /**
         * TEXT FIELD.
         */
        .with({ type: FieldType.TEXT }, (field) => {
          void handleTextFieldClick({ field, text: null })
            .then(async (payload) => {
              if (payload) {
                await signField(field.id, payload);
              }
            })
            .finally(() => onGroupFieldPointer(field.id, 'leave'));
        })
        /**
         * EMAIL FIELD.
         */
        .with({ type: FieldType.EMAIL }, (field) => {
          void handleEmailFieldClick({ field, email: localEmail, placeholderEmail })
            .then(async (payload) => {
              if (payload) {
                await signField(field.id, payload);
              }

              if (payload?.value) {
                setEmail(payload.value);
              }
            })
            .finally(() => onGroupFieldPointer(field.id, 'leave'));
        })
        /**
         * INITIALS FIELD.
         */
        .with({ type: FieldType.INITIALS }, (field) => {
          const initials = localFullName ? extractInitials(localFullName) : null;

          void handleInitialsFieldClick({ field, initials }).then(async (payload) => {
            if (payload) {
              await signField(field.id, payload);
            }
          });
        })
        /**
         * NAME FIELD.
         */
        .with({ type: FieldType.NAME }, (field) => {
          void handleNameFieldClick({ field, name: localFullName })
            .then(async (payload) => {
              if (payload) {
                await signField(field.id, payload);
              }

              if (payload?.value) {
                setFullName(payload.value);
              }
            })
            .finally(() => onGroupFieldPointer(field.id, 'leave'));
        })
        /**
         * DROPDOWN FIELD.
         */
        .with({ type: FieldType.DROPDOWN }, (field) => {
          void handleDropdownFieldClick({ field, text: null })
            .then(async (payload) => {
              if (payload) {
                await signField(field.id, payload);
              }
            })
            .finally(() => onGroupFieldPointer(field.id, 'leave'));
        })
        /**
         * DATE FIELD.
         */
        .with({ type: FieldType.DATE }, (field) => {
          void signField(field.id, {
            type: FieldType.DATE,
            value: !field.inserted,
          });
        })
        /**
         * SIGNATURE FIELD.
         */
        .with({ type: FieldType.SIGNATURE }, (field) => {
          void handleSignatureFieldClick({
            field,
            fullName: fullName.current,
            signature: signature.current,
            typedSignatureEnabled: envelope.documentMeta.typedSignatureEnabled,
            uploadSignatureEnabled: envelope.documentMeta.uploadSignatureEnabled,
            drawSignatureEnabled: envelope.documentMeta.drawSignatureEnabled,
          }).then(async (payload) => {
            if (!payload) {
              return;
            }

            if (payload.value) {
              await executeActionAuthProcedure({
                onReauthFormSubmit: async (authOptions) => {
                  await signField(field.id, payload, authOptions);
                },
                actionTarget: field.type,
              });

              setSignature(payload.value);
            } else {
              await signField(field.id, payload);
            }
          });
        })
        .exhaustive();
    };

    fieldGroup.off('pointerdown');
    fieldGroup.on('pointerdown', handleFieldGroupClick);

    // Grouped fields show a navigation bar while hovered.
    fieldGroup.off('mouseenter.group mouseleave.group');

    if (fieldToRender.groupId && !fieldToRender.fieldMeta?.readOnly) {
      fieldGroup.on('mouseenter.group', () => onGroupFieldPointer(fieldToRender.id, 'enter'));
      fieldGroup.on('mouseleave.group', () => onGroupFieldPointer(fieldToRender.id, 'leave'));
    }
  };

  const renderFieldOnLayer = (
    unparsedField: Field & { signature?: Signature | null },
    fieldCanvasStyleCache: FieldCanvasStyleCache,
  ) => {
    try {
      unsafeRenderFieldOnLayer(unparsedField, fieldCanvasStyleCache);
    } catch (err) {
      console.error(err);

      analytics.captureException(err, {
        source: 'signing',
        location: 'page_render',
        recipientId: recipient.id,
        envelopeId: envelope.id,
      });

      setRenderError(true);
    }
  };

  const renderFields = () => {
    if (!pageLayer.current) {
      console.error('Layer not loaded yet');
      return;
    }

    const fieldCanvasStyleCache = createFieldCanvasStyleCache();

    // Render current recipient fields which have changed or are not currently rendered.
    for (const field of localPageFields) {
      const existingCachedField = cachedRenderFields.current.get(field.id);
      const isFieldCurrentlyRendered = pageLayer.current.findOne(`#${field.id}`);

      if (
        !isFieldCurrentlyRendered ||
        !existingCachedField ||
        existingCachedField.inserted !== field.inserted ||
        existingCachedField.customText !== field.customText
      ) {
        renderFieldOnLayer(field, fieldCanvasStyleCache);
        cachedRenderFields.current.set(field.id, field);
      }
    }

    // Render other recipient signed and inserted fields.
    for (const field of localPageOtherRecipientFields) {
      try {
        const { fieldGroup } = renderField({
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
          fieldCanvasStyleCache,
        });

        // Other-recipient fields are display-only — they have no click handlers
        // and shouldn't intercept events meant for the current recipient's
        // fields. Disable hit detection on the entire group.
        fieldGroup.listening(false);
      } catch (err) {
        console.error('Unable to render one or more fields belonging to other recipients.');
        console.error(err);
      }
    }
  };

  /**
   * Notify the embedding context of every field that was signed or unsigned.
   *
   * Fields in the same group are updated together by the server, so the response can
   * contain fields which were not in the request. Those are reported using the value
   * returned by the server.
   */
  const notifyEmbedFieldsSigned = (
    fieldValues: TSignEnvelopeFieldValues,
    signedFields: Pick<Field, 'id' | 'type' | 'inserted' | 'customText'>[],
  ) => {
    for (const signedField of signedFields) {
      const fieldId = signedField.id;

      // ?: The two callbacks below are used within the embedding context
      if (signedField.inserted && onFieldSigned) {
        const requestedFieldValue = fieldValues.find((fieldValue) => fieldValue.fieldId === fieldId)?.fieldValue;

        const value = requestedFieldValue
          ? toEmbedFieldValue(requestedFieldValue.value)
          : toEmbedFieldValue(toSignedFieldValue(signedField));

        const isBase64 = value ? isBase64Image(value) : undefined;

        onFieldSigned({ fieldId, value, isBase64 });
      }

      if (!signedField.inserted && onFieldUnsigned) {
        onFieldUnsigned({ fieldId });
      }
    }
  };

  const signFields = async (fieldValues: TSignEnvelopeFieldValues, authOptions?: TRecipientActionAuth) => {
    try {
      const signedFields = await signFieldsInternal(fieldValues, authOptions);

      notifyEmbedFieldsSigned(fieldValues, signedFields);
    } catch (err) {
      console.error(err);

      analytics.captureException(err, {
        source: 'signing',
        location: 'sign_field',
        fieldType: fieldValues[0]?.fieldValue.type,
        recipientId: recipient.id,
        envelopeId: envelope.id,
      });

      toast({
        title: t`Error`,
        description: t`An error occurred while signing the field.`,
        variant: 'destructive',
      });

      throw err;
    }
  };

  const signField = async (fieldId: number, payload: TSignEnvelopeFieldValue, authOptions?: TRecipientActionAuth) => {
    await signFields([{ fieldId, fieldValue: payload }], authOptions);
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

    // When the pending-field tooltip toggles, all unsigned required fields need to
    // be re-rendered so their stroke color updates (green <-> orange). Field-level
    // properties like `inserted` and `customText` haven't changed, so the cache
    // would otherwise skip them — clear it to force a fresh render.
    if (prevShowPendingFieldTooltip.current !== showPendingFieldTooltip || showPendingFieldTooltip) {
      cachedRenderFields.current.clear();
      prevShowPendingFieldTooltip.current = showPendingFieldTooltip;
    }

    renderFields();

    pageLayer.current.batchDraw();
  }, [localPageFields, showPendingFieldTooltip, pendingFieldIds]);

  /**
   * Spinners don't change the cached field data, so sync them directly whenever the set
   * of fields being signed changes.
   */
  useEffect(() => {
    if (!pageLayer.current) {
      return;
    }

    for (const field of localPageFields) {
      const fieldGroup = pageLayer.current.findOne(`#${field.id}`);

      if (fieldGroup instanceof Konva.Group) {
        syncFieldSpinner(fieldGroup, signingFieldIds.has(field.id));
      }
    }

    pageLayer.current.batchDraw();
  }, [signingFieldIds, localPageFields]);

  /**
   * Rerender the whole page if the selected assistant recipient changes.
   */
  useEffect(() => {
    if (!pageLayer.current || !stage.current) {
      return;
    }

    // Rerender the whole page.
    pageLayer.current.destroyChildren();
    cachedRenderFields.current.clear();

    renderFields();

    pageLayer.current.batchDraw();
  }, [selectedAssistantRecipient]);

  /**
   * Highlights don't change the cached field data, so sync them directly whenever the
   * highlighted group changes. Full re-renders pick them up through the render path.
   */
  useEffect(() => {
    if (!pageLayer.current) {
      return;
    }

    for (const field of localPageFields) {
      const fieldGroup = pageLayer.current.findOne(`#${field.id}`);

      if (fieldGroup instanceof Konva.Group) {
        syncFieldGroupHighlight(fieldGroup, groupHighlightLevels.get(field.id) ?? null);
      }
    }

    pageLayer.current.batchDraw();
  }, [groupHighlightLevels, localPageFields]);

  if (!currentEnvelopeItem) {
    return null;
  }

  return (
    <>
      {showPendingFieldTooltip &&
        nextPendingSigningItem &&
        nextPendingSigningItem.primaryField.envelopeItemId === currentEnvelopeItem?.id &&
        nextPendingSigningItem.primaryField.page === pageNumber && (
          <EnvelopeFieldToolTip
            key={nextPendingSigningItem.primaryField.id}
            field={nextPendingSigningItem.primaryField}
            color="warning"
            open={true}
          >
            <SigningItemTooltipMessage item={nextPendingSigningItem} />
          </EnvelopeFieldToolTip>
        )}

      <AnimatePresence>
        {groupBarField && groupBarNavigation && (
          <EnvelopeFieldGroupBar
            key={groupBarField.id}
            field={groupBarField}
            position={groupBarNavigation.position}
            count={groupBarNavigation.fields.length}
            color={getSigningFieldColor(groupBarField)}
            onPrevious={() => onGroupBarNavigate('previous')}
            onNext={() => onGroupBarNavigate('next')}
            onHoverChange={(isHovering) => onGroupBarPointer(groupBarField.id, isHovering ? 'enter' : 'leave')}
          />
        )}
      </AnimatePresence>

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
    </>
  );
};

/**
 * Explains what the recipient must do to resolve a pending signing item.
 */
const SigningItemTooltipMessage = ({ item }: { item: SigningItem }) => {
  const { validationError } = item;

  if (!validationError) {
    return <Trans>Click to insert field</Trans>;
  }

  return match(validationError.validationRule)
    .with('>=', () => (
      <Plural
        value={validationError.validationLength}
        one="Select at least # option"
        other="Select at least # options"
      />
    ))
    .with('=', () => (
      <Plural value={validationError.validationLength} one="Select exactly # option" other="Select exactly # options" />
    ))
    .with('<=', () => (
      <Plural value={validationError.validationLength} one="Select at most # option" other="Select at most # options" />
    ))
    .exhaustive();
};

/**
 * Serialises a field value for the embed `onFieldSigned` callback.
 */
const toEmbedFieldValue = (value: unknown): string | undefined => {
  return value ? JSON.stringify(value) : undefined;
};

/**
 * Derives the signed value of a field from the server response, matching the shape the
 * client would have sent for that field type.
 */
const toSignedFieldValue = (field: Pick<Field, 'type' | 'customText'>): unknown => {
  return match(field.type)
    .with(FieldType.CHECKBOX, () => parseCheckboxCustomText(field.customText))
    .with(FieldType.RADIO, () => (field.customText === '' ? null : Number(field.customText)))
    .otherwise(() => field.customText);
};
