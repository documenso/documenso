import { useHeldValue } from '@documenso/lib/client-only/hooks/use-held-value';
import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { isFieldGroupValueShared } from '@documenso/lib/constants/field-groups';
import { isBase64Image } from '@documenso/lib/constants/signatures';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import type { EnvelopeForSigningResponse } from '@documenso/lib/server-only/envelope/get-envelope-for-recipient-signing';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import {
  extractFieldInsertionValues,
  extractGroupedCheckboxInsertionValues,
  extractGroupedRadioInsertionValues,
  type FieldInsertionValues,
} from '@documenso/lib/utils/envelope-signing';
import { getNextDictatableRecipient } from '@documenso/lib/utils/recipient-groups';
import { isRecipientBefore } from '@documenso/lib/utils/recipients';
import { getSigningItems, isSigningItemPending, type SigningItem } from '@documenso/lib/utils/signing-items';
import { trpc } from '@documenso/trpc/react';
import type {
  TSignEnvelopeFieldResponse,
  TSignEnvelopeFieldValue,
  TSignEnvelopeFieldValues,
} from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { FIELD_GROUP_BAR_DATA_ATTRIBUTE } from '@documenso/ui/components/field/envelope-field-group-bar';
import { EnvelopeType, type Field, FieldType, type Recipient, RecipientRole, SigningStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { prop, sortBy } from 'remeda';
import { match } from 'ts-pattern';

export type EnvelopeSigningContextValue = {
  isDirectTemplate: boolean;

  fullName: string;
  setFullName: (_value: string) => void;
  email: string;
  setEmail: (_value: string) => void;
  signature: string | null;
  setSignature: (_value: string | null) => void;

  showPendingFieldTooltip: boolean;
  setShowPendingFieldTooltip: (_value: boolean) => void;

  envelopeData: EnvelopeForSigningResponse;
  envelope: EnvelopeForSigningResponse['envelope'];

  recipient: EnvelopeForSigningResponse['recipient'];
  recipientFields: Field[];

  /**
   * Every signing item for the recipient, where fields in a group form a single item.
   */
  recipientSigningItems: SigningItem[];

  /**
   * Signing items which still require action before the recipient can complete, sorted
   * by document order.
   */
  pendingRecipientSigningItems: SigningItem[];

  /**
   * The primary field of each pending signing item, sorted by document order.
   */
  recipientFieldsRemaining: Field[];

  /**
   * Signing items which must be completed by the recipient.
   */
  requiredRecipientSigningItems: SigningItem[];
  selectedAssistantRecipientFields: Field[];
  nextRecipient: EnvelopeForSigningResponse['envelope']['recipients'][number] | null;
  otherRecipientCompletedFields: (Field & {
    recipient: Pick<Recipient, 'name' | 'email' | 'signingStatus' | 'role'>;
  })[];
  assistantRecipients: EnvelopeForSigningResponse['envelope']['recipients'];
  assistantFields: Field[];
  setSelectedAssistantRecipientId: (_value: number | null) => void;
  selectedAssistantRecipient: EnvelopeForSigningResponse['envelope']['recipients'][number] | null;

  signField: (
    _fieldId: number,
    _value: TSignEnvelopeFieldValue,
    authOptions?: TRecipientActionAuth,
  ) => Promise<Pick<Field, 'id' | 'inserted'>>;

  /**
   * IDs of every field currently being signed, including the other members of any group
   * the signed fields belong to, since the whole group is updated together.
   */
  signingFieldIds: Set<number>;

  /**
   * The grouped field or group bar the pointer is currently over.
   */
  groupPointerTarget: TGroupPointerTarget | null;

  /**
   * The grouped field whose navigation bar is shown. Lingers briefly after the pointer
   * leaves so the bar can be reached.
   */
  groupBarFieldId: number | null;

  /**
   * The grouped field whose group is highlighted. Follows the pointer immediately.
   */
  groupHighlightFieldId: number | null;

  /**
   * Reports the pointer entering or leaving a grouped field on the canvas.
   */
  onGroupFieldPointer: (_fieldId: number, _event: 'enter' | 'leave') => void;

  /**
   * Reports the pointer entering or leaving the group bar shown for a field.
   */
  onGroupBarPointer: (_fieldId: number, _event: 'enter' | 'leave') => void;

  /**
   * Resolves the position of a field within its group and its neighbours, ordered the
   * same way as the next pending field.
   */
  getFieldGroupNavigation: (_fieldId: number) => TFieldGroupNavigation | null;

  /**
   * Moves the group bar to the previous or next member of the field's group and keeps
   * it open there until the group is valid, the recipient clicks elsewhere or hovers
   * another grouped field.
   */
  navigateFieldGroup: (_fieldId: number, _direction: 'previous' | 'next') => Field | null;

  /**
   * Sign multiple fields at once. Only supported for fields within the same checkbox group.
   */
  signFields: (
    _fieldValues: TSignEnvelopeFieldValues,
    authOptions?: TRecipientActionAuth,
  ) => Promise<Pick<Field, 'id' | 'type' | 'inserted' | 'customText'>[]>;
};

type SignedField = Pick<TSignEnvelopeFieldResponse['signedFields'][number], 'id'> &
  Partial<TSignEnvelopeFieldResponse['signedFields'][number]>;

/**
 * How long the group bar lingers after the pointer leaves, so it can be reached.
 */
const GROUP_BAR_HOLD_MS = 500;

export type TGroupPointerTarget = {
  fieldId: number;
  source: 'field' | 'bar';
};

export type TFieldGroupNavigation = {
  /**
   * Every field in the group in document order.
   */
  fields: Field[];
  /**
   * One based position of the field within the group.
   */
  position: number;
  previousField: Field;
  nextField: Field;
};

const EnvelopeSigningContext = createContext<EnvelopeSigningContextValue | null>(null);

export const useEnvelopeSigningContext = () => {
  return useContext(EnvelopeSigningContext);
};

export const useRequiredEnvelopeSigningContext = () => {
  const context = useEnvelopeSigningContext();

  if (!context) {
    throw new Error('Signing context is required');
  }

  return context;
};

export interface EnvelopeSigningProviderProps {
  fullName?: string | null;
  email?: string | null;
  signature?: string | null;
  envelopeData: EnvelopeForSigningResponse;
  children: React.ReactNode;
}

/**
 * Inject prefilled date fields for the current recipient.
 *
 * The dates are filled in correctly when the recipient "completes" the document.
 */
const prefillDateFields = (data: EnvelopeForSigningResponse): EnvelopeForSigningResponse => {
  const { timezone, dateFormat } = data.envelope.documentMeta;

  const formattedDate = DateTime.now()
    .setZone(timezone ?? DEFAULT_DOCUMENT_TIME_ZONE)
    .toFormat(dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT);

  const prefillField = <T extends { type: FieldType; inserted: boolean; customText: string; fieldMeta: unknown }>(
    field: T,
  ): T => {
    if (field.type !== FieldType.DATE || field.inserted) {
      return field;
    }

    return {
      ...field,
      customText: formattedDate,
      inserted: true,
      fieldMeta: {
        ...(typeof field.fieldMeta === 'object' ? field.fieldMeta : {}),
        readOnly: true,
      },
    };
  };

  return {
    ...data,
    envelope: {
      ...data.envelope,
      recipients: data.envelope.recipients.map((recipient) => ({
        ...recipient,
        fields: recipient.fields.map(prefillField),
      })),
    },
    recipient: {
      ...data.recipient,
      fields: data.recipient.fields.map(prefillField),
    },
  };
};

export const EnvelopeSigningProvider = ({
  fullName: initialFullName,
  email: initialEmail,
  signature: initialSignature,
  envelopeData: initialEnvelopeData,
  children,
}: EnvelopeSigningProviderProps) => {
  const [envelopeData, setEnvelopeData] = useState(() => prefillDateFields(initialEnvelopeData));

  const { envelope, recipient } = envelopeData;

  const [fullName, setFullName] = useState(initialFullName || '');
  const [email, setEmail] = useState(initialEmail || '');

  const [showPendingFieldTooltip, setShowPendingFieldTooltip] = useState(false);

  const isDirectTemplate = envelope.type === EnvelopeType.TEMPLATE;

  /**
   * Replace the provided fields in the local envelope data.
   */
  const setSignedFields = (signedFields: SignedField[]) => {
    const signedFieldsById = new Map(signedFields.map((field) => [field.id, field]));

    const replaceField = <T extends { id: number }>(field: T): T => {
      const signedField = signedFieldsById.get(field.id);

      return signedField ? { ...field, ...signedField } : field;
    };

    setEnvelopeData((prev) => ({
      ...prev,
      envelope: {
        ...prev.envelope,
        recipients: prev.envelope.recipients.map((recipient) => ({
          ...recipient,
          fields: recipient.fields.map(replaceField),
        })),
      },
      recipient: {
        ...prev.recipient,
        fields: prev.recipient.fields.map(replaceField),
      },
    }));
  };

  const { mutateAsync: signEnvelopeField } = trpc.envelope.field.sign.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (data) => {
      setSignedFields(data.signedFields);
    },
  });

  // Ensure the user signature doesn't show up if it's not allowed.
  const [signature, setSignature] = useState(
    (() => {
      const sig = initialSignature || '';
      const isBase64 = isBase64Image(sig);

      if (
        !sig &&
        (envelope.documentMeta.uploadSignatureEnabled || envelope.documentMeta.drawSignatureEnabled) &&
        envelopeData.recipientSignature?.signatureImageAsBase64
      ) {
        return envelopeData.recipientSignature.signatureImageAsBase64;
      }

      if (!sig && envelope.documentMeta.typedSignatureEnabled && envelopeData.recipientSignature?.typedSignature) {
        return envelopeData.recipientSignature.typedSignature;
      }

      if (isBase64 && (envelope.documentMeta.uploadSignatureEnabled || envelope.documentMeta.drawSignatureEnabled)) {
        return sig;
      }

      if (!isBase64 && envelope.documentMeta.typedSignatureEnabled) {
        return sig;
      }

      return null;
    })(),
  );

  /**
   * Every signing item for the actual recipient, sorted by document order.
   */
  const recipientSigningItems = useMemo(() => {
    const itemsWithOrder = getSigningItems(envelopeData.recipient.fields).map((item) => {
      const envelopeItem = envelope.envelopeItems.find(
        (envelopeItem) => envelopeItem.id === item.primaryField.envelopeItemId,
      );

      if (!envelopeItem) {
        throw new Error('Missing envelope item');
      }

      return {
        item,
        envelopeItemOrder: envelopeItem.order,
        page: item.primaryField.page,
        positionY: Number(item.primaryField.positionY),
      };
    });

    return sortBy(
      itemsWithOrder,
      [prop('envelopeItemOrder'), 'asc'],
      [prop('page'), 'asc'],
      [prop('positionY'), 'asc'],
    ).map(({ item }) => item);
  }, [envelopeData.recipient.fields, envelope.envelopeItems]);

  const pendingRecipientSigningItems = useMemo(
    () => recipientSigningItems.filter(isSigningItemPending),
    [recipientSigningItems],
  );

  const recipientFieldsRemaining = useMemo(
    () => pendingRecipientSigningItems.map((item) => item.primaryField),
    [pendingRecipientSigningItems],
  );

  const requiredRecipientSigningItems = useMemo(
    () => recipientSigningItems.filter((item) => item.isRequired),
    [recipientSigningItems],
  );

  /**
   * All the fields for the actual recipient.
   */
  const recipientFields = useMemo(() => {
    return envelopeData.recipient.fields;
  }, [envelopeData.recipient.fields]);

  /**
   * Assistant recipients are those positioned strictly after the assistant —
   * never their own group peers.
   */
  const assistantRecipients = useMemo(() => {
    if (recipient.role !== RecipientRole.ASSISTANT) {
      return [];
    }

    return envelope.recipients.filter((r) => isRecipientBefore(recipient, r));
  }, [envelope.recipients, recipient]);

  /**
   * Assistant fields are those fulfill all of the following:
   * - From recipients that have not signed
   * - After the assistant signing order
   * - Are not signature fields
   */
  const assistantFields = useMemo(() => {
    return assistantRecipients
      .filter((r) => r.signingStatus !== SigningStatus.SIGNED)
      .flatMap((r) => r.fields.filter((field) => field.type !== FieldType.SIGNATURE));
  }, [assistantRecipients]);

  const [groupPointerTarget, setGroupPointerTarget] = useState<TGroupPointerTarget | null>(null);
  const [pinnedGroupFieldId, setPinnedGroupFieldId] = useState<number | null>(null);

  // The bar lingers after the pointer leaves so it can be reached; the highlight does not.
  const [heldGroupPointerTarget, dropHeldGroupPointerTarget] = useHeldValue(groupPointerTarget, GROUP_BAR_HOLD_MS);

  /**
   * Signing items for every recipient the current recipient may act for, so assistants
   * can navigate the groups of the recipient they are prefilling for.
   */
  const navigableSigningItems = useMemo(() => {
    if (recipient.role !== RecipientRole.ASSISTANT) {
      return recipientSigningItems;
    }

    return getSigningItems(assistantFields);
  }, [recipient.role, recipientSigningItems, assistantFields]);

  const groupItemByFieldId = useMemo(() => {
    const map = new Map<number, SigningItem>();

    for (const item of navigableSigningItems) {
      if (!item.groupId) {
        continue;
      }

      for (const field of item.fields) {
        map.set(field.id, item);
      }
    }

    return map;
  }, [navigableSigningItems]);

  const getFieldGroupNavigation = useCallback(
    (fieldId: number): TFieldGroupNavigation | null => {
      const item = groupItemByFieldId.get(fieldId);

      if (!item) {
        return null;
      }

      const index = item.fields.findIndex((field) => field.id === fieldId);
      const count = item.fields.length;

      return {
        fields: item.fields,
        position: index + 1,
        previousField: item.fields[(index - 1 + count) % count],
        nextField: item.fields[(index + 1) % count],
      };
    },
    [groupItemByFieldId],
  );

  const onGroupFieldPointer = (fieldId: number, event: 'enter' | 'leave') => {
    if (event === 'enter') {
      setGroupPointerTarget({ fieldId, source: 'field' });

      // Hovering a different grouped field moves the focus there for good.
      setPinnedGroupFieldId((current) => (current === fieldId ? current : null));

      return;
    }

    // The canvas reports the pointer leaving a field after the bar reports it entering,
    // so only a matching field target is cleared.
    setGroupPointerTarget((current) => (current?.source === 'field' && current.fieldId === fieldId ? null : current));
  };

  const onGroupBarPointer = (fieldId: number, event: 'enter' | 'leave') => {
    if (event === 'enter') {
      setGroupPointerTarget({ fieldId, source: 'bar' });
      return;
    }

    setGroupPointerTarget((current) => (current?.source === 'bar' && current.fieldId === fieldId ? null : current));
  };

  const navigateFieldGroup = (fieldId: number, direction: 'previous' | 'next'): Field | null => {
    const navigation = getFieldGroupNavigation(fieldId);

    if (!navigation) {
      return null;
    }

    const targetField = direction === 'previous' ? navigation.previousField : navigation.nextField;

    // The bar moves away from under the pointer, so it will not report the pointer leaving.
    setGroupPointerTarget(null);
    setPinnedGroupFieldId(targetField.id);

    return targetField;
  };

  // Clicking anywhere other than the bar itself releases the pinned bar, and ends any
  // lingering hover since the pointer is clearly no longer on its way to the bar.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const isBarClick = event.target instanceof Element && event.target.closest(`[${FIELD_GROUP_BAR_DATA_ATTRIBUTE}]`);

      if (isBarClick) {
        return;
      }

      setPinnedGroupFieldId(null);
      dropHeldGroupPointerTarget();
    };

    document.addEventListener('pointerdown', onPointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [dropHeldGroupPointerTarget]);

  // Release the pinned bar once its group has been inserted and is valid. An optional
  // group which has not been touched yet is not considered valid, so the bar stays until
  // the recipient acts on it.
  useEffect(() => {
    if (pinnedGroupFieldId === null) {
      return;
    }

    const item = groupItemByFieldId.get(pinnedGroupFieldId);

    const isValid = item !== undefined && item.isInserted && item.validationError === null;

    if (!item || isValid) {
      setPinnedGroupFieldId(null);
    }
  }, [pinnedGroupFieldId, groupItemByFieldId]);

  /**
   * The next pending grouped field while it is being pointed out, so touch devices,
   * which cannot hover, can still reach its bar.
   */
  const nextPendingGroupFieldId = useMemo(() => {
    const nextPendingSigningItem = pendingRecipientSigningItems[0];

    if (showPendingFieldTooltip && nextPendingSigningItem?.groupId) {
      return nextPendingSigningItem.primaryField.id;
    }

    return null;
  }, [showPendingFieldTooltip, pendingRecipientSigningItems]);

  // A pin always wins: hovering another field releases it, so a pin can only coexist
  // with a hover on its own field or a hover which is merely lingering.
  const groupBarFieldId = pinnedGroupFieldId ?? heldGroupPointerTarget?.fieldId ?? nextPendingGroupFieldId;
  const groupHighlightFieldId = pinnedGroupFieldId ?? groupPointerTarget?.fieldId ?? nextPendingGroupFieldId;

  /**
   * The recipient that the assistant has currently selected to sign on behalf of.
   */
  const [selectedAssistantRecipientId, setSelectedAssistantRecipientId] = useState<number | null>(
    assistantRecipients[0]?.id || null,
  );

  const selectedAssistantRecipient = useMemo(() => {
    return envelope.recipients.find((r) => r.id === selectedAssistantRecipientId) || null;
  }, [envelope.recipients, selectedAssistantRecipientId]);

  const selectedAssistantRecipientFields = useMemo(() => {
    return assistantFields.filter((field) => field.recipientId === selectedAssistantRecipient?.id);
  }, [assistantFields, selectedAssistantRecipient]);

  /**
   * Fields that have been completed by other recipients.
   */
  const otherRecipientCompletedFields = envelope.recipients
    .filter(({ signingStatus }) => signingStatus === SigningStatus.SIGNED)
    .flatMap((recipient) =>
      recipient.fields.map((field) => ({
        ...field,
        recipient: {
          name: recipient.name,
          email: recipient.email,
          signingStatus: recipient.signingStatus,
          role: recipient.role,
        },
      })),
    )
    .filter((field) => field.inserted);

  const nextRecipient = useMemo(() => {
    if (envelope.documentMeta.signingOrder !== 'SEQUENTIAL') {
      return null;
    }

    return getNextDictatableRecipient({
      recipients: envelope.recipients,
      currentRecipientId: recipient.id,
    });
  }, [envelope.documentMeta?.signingOrder, envelope.recipients, recipient.id]);

  const [signingFieldIds, setSigningFieldIds] = useState<Set<number>>(new Set());

  /**
   * Resolves every field affected by signing the given fields, which includes the other
   * members of any group they belong to.
   */
  const resolveAffectedFieldIds = (fieldIds: number[]): number[] => {
    const allFields = envelope.recipients.flatMap((currentRecipient) => currentRecipient.fields);

    const groupIds = new Set(
      fieldIds.flatMap((fieldId) => {
        const groupId = allFields.find((field) => field.id === fieldId)?.groupId;

        return groupId ? [groupId] : [];
      }),
    );

    const groupMemberIds = allFields
      .filter((field) => field.groupId && groupIds.has(field.groupId))
      .map((field) => field.id);

    return Array.from(new Set([...fieldIds, ...groupMemberIds]));
  };

  const signFields = async (fieldValues: TSignEnvelopeFieldValues, authOptions?: TRecipientActionAuth) => {
    const affectedFieldIds = resolveAffectedFieldIds(fieldValues.map((fieldValue) => fieldValue.fieldId));

    setSigningFieldIds((prev) => new Set([...prev, ...affectedFieldIds]));

    try {
      // Set the fields locally for direct templates.
      if (isDirectTemplate) {
        return handleDirectTemplateFieldsInsertion(fieldValues);
      }

      const { signedFields } = await signEnvelopeField({
        token: envelopeData.recipient.token,
        fieldValues,
        authOptions,
      });

      return signedFields;
    } finally {
      setSigningFieldIds((prev) => {
        const next = new Set(prev);

        for (const fieldId of affectedFieldIds) {
          next.delete(fieldId);
        }

        return next;
      });
    }
  };

  const signField = async (
    fieldId: number,
    fieldValue: TSignEnvelopeFieldValue,
    authOptions?: TRecipientActionAuth,
  ) => {
    const signedFields = await signFields([{ fieldId, fieldValue }], authOptions);

    const signedField = signedFields.find((field) => field.id === fieldId);

    if (!signedField) {
      throw new Error('Signed field missing from response');
    }

    return signedField;
  };

  /**
   * Mirrors the server side signing logic for direct templates, where fields are only
   * held locally until the document is created.
   */
  const handleDirectTemplateFieldsInsertion = (fieldValues: TSignEnvelopeFieldValues) => {
    const [{ fieldId, fieldValue }] = fieldValues;

    const foundField = recipient.fields.find((field) => field.id === fieldId);

    if (!foundField) {
      throw new Error('Not possible');
    }

    const groupFields = foundField.groupId
      ? recipient.fields.filter((field) => field.groupId === foundField.groupId && field.type === foundField.type)
      : [foundField];

    const fieldInsertionValues: FieldInsertionValues[] = match({
      type: foundField.type,
      isGrouped: foundField.groupId !== null,
    })
      .with({ type: FieldType.RADIO, isGrouped: true }, () => {
        if (fieldValue.type !== FieldType.RADIO) {
          throw new Error('Not possible');
        }

        return extractGroupedRadioInsertionValues({
          fields: groupFields,
          selectedFieldId: foundField.id,
          selectedIndex: fieldValue.value,
        });
      })
      .with({ type: FieldType.CHECKBOX, isGrouped: true }, () => {
        return extractGroupedCheckboxInsertionValues({
          fields: groupFields,
          fieldValues: fieldValues.map((value) => {
            if (value.fieldValue.type !== FieldType.CHECKBOX) {
              throw new Error('Not possible');
            }

            return {
              fieldId: value.fieldId,
              value: value.fieldValue.value,
            };
          }),
        });
      })
      .otherwise(() => {
        const insertionValues = extractFieldInsertionValues({
          fieldValue,
          field: foundField,
          documentMeta: envelope.documentMeta,
        });

        // Fields in the same group act as a single field, so the value is applied to every member.
        const fieldsToUpdate =
          foundField.groupId && isFieldGroupValueShared(foundField.type) ? groupFields : [foundField];

        return fieldsToUpdate.map((fieldToUpdate) => ({
          fieldId: fieldToUpdate.id,
          ...insertionValues,
        }));
      });

    const updatedFields = fieldInsertionValues.map(({ fieldId: updatedFieldId, ...insertionValues }) => {
      const fieldToUpdate = recipient.fields.find((field) => field.id === updatedFieldId);

      if (!fieldToUpdate) {
        throw new Error('Not possible');
      }

      const updatedField = {
        ...fieldToUpdate,
        ...insertionValues,
      };

      if (updatedField.id === foundField.id && fieldValue.type === FieldType.SIGNATURE) {
        const isBase64 = isBase64Image(fieldValue.value || '');

        updatedField.signature = fieldValue.value
          ? {
              signatureImageAsBase64: isBase64 ? fieldValue.value : null,
              typedSignature: isBase64 ? null : fieldValue.value,
              recipientId: recipient.id,
              created: new Date(),
              // Dummy IDs.
              id: 0,
              fieldId: 0,
            }
          : null;
      }

      return updatedField;
    });

    setSignedFields(updatedFields);

    return updatedFields;
  };

  return (
    <EnvelopeSigningContext.Provider
      value={{
        isDirectTemplate,
        fullName,
        setFullName,
        email,
        setEmail,
        signature,
        setSignature,
        envelopeData,
        envelope,

        showPendingFieldTooltip,
        setShowPendingFieldTooltip,

        recipient,
        recipientFields,
        recipientSigningItems,
        pendingRecipientSigningItems,
        recipientFieldsRemaining,
        requiredRecipientSigningItems,
        nextRecipient,

        otherRecipientCompletedFields,
        assistantRecipients,
        assistantFields,
        setSelectedAssistantRecipientId,
        selectedAssistantRecipient,
        selectedAssistantRecipientFields,

        signingFieldIds,
        groupPointerTarget,
        groupBarFieldId,
        groupHighlightFieldId,
        onGroupFieldPointer,
        onGroupBarPointer,
        getFieldGroupNavigation,
        navigateFieldGroup,
        signField,
        signFields,
      }}
    >
      {children}
    </EnvelopeSigningContext.Provider>
  );
};

EnvelopeSigningProvider.displayName = 'EnvelopeSigningProvider';
