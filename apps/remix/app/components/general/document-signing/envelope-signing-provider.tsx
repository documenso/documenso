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
import {
  getSigningItemPendingFields,
  getSigningItems,
  isSigningItemPending,
  type SigningItem,
} from '@documenso/lib/utils/signing-items';
import { trpc } from '@documenso/trpc/react';
import type {
  TSignEnvelopeFieldResponse,
  TSignEnvelopeFieldValue,
} from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { EnvelopeType, type Field, FieldType, type Recipient, RecipientRole, SigningStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { createContext, useContext, useMemo, useState } from 'react';
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
   * Every field the recipient still has to fill in, with each field in a group counted.
   */
  recipientFieldsRemaining: Field[];

  /**
   * Every field which counts towards the recipient's progress: the fields of required
   * items, plus optional items which have been filled in but break their rule.
   */
  requiredRecipientFields: Field[];
  selectedAssistantRecipientFields: Field[];
  nextRecipient: EnvelopeForSigningResponse['envelope']['recipients'][number] | null;
  otherRecipientCompletedFields: (Field & {
    recipient: Pick<Recipient, 'name' | 'email' | 'signingStatus' | 'role'>;
  })[];
  assistantRecipients: EnvelopeForSigningResponse['envelope']['recipients'];
  assistantFields: Field[];
  setSelectedAssistantRecipientId: (_value: number | null) => void;
  selectedAssistantRecipient: EnvelopeForSigningResponse['envelope']['recipients'][number] | null;

  /**
   * Signs a field. The rest of its group is updated with it, so every affected field is
   * returned.
   */
  signField: (
    _fieldId: number,
    _value: TSignEnvelopeFieldValue,
    authOptions?: TRecipientActionAuth,
  ) => Promise<Pick<Field, 'id' | 'type' | 'inserted' | 'customText'>[]>;

  /**
   * IDs of every field currently being signed, including the other fields of any group
   * the signed fields belong to, since the whole group is updated together.
   */
  signingFieldIds: Set<number>;
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
  const setSignedFields = (signedFields: TSignEnvelopeFieldResponse['signedFields']) => {
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
        positionX: Number(item.primaryField.positionX),
      };
    });

    return sortBy(
      itemsWithOrder,
      [prop('envelopeItemOrder'), 'asc'],
      [prop('page'), 'asc'],
      [prop('positionY'), 'asc'],
      [prop('positionX'), 'asc'],
    ).map(({ item }) => item);
  }, [envelopeData.recipient.fields, envelope.envelopeItems]);

  const pendingRecipientSigningItems = useMemo(
    () => recipientSigningItems.filter(isSigningItemPending),
    [recipientSigningItems],
  );

  const recipientFieldsRemaining = useMemo(
    () => pendingRecipientSigningItems.flatMap(getSigningItemPendingFields),
    [pendingRecipientSigningItems],
  );

  // Pending optional items are included so the remaining count can never exceed the total.
  const requiredRecipientFields = useMemo(
    () =>
      recipientSigningItems
        .filter((item) => item.isRequired || isSigningItemPending(item))
        .flatMap((item) => item.fields),
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
   * Every field affected by signing the given field, which includes the rest of its group.
   */
  const resolveAffectedFieldIds = (fieldId: number): number[] => {
    const allFields = envelope.recipients.flatMap((currentRecipient) => currentRecipient.fields);

    const groupId = allFields.find((field) => field.id === fieldId)?.groupId;

    if (!groupId) {
      return [fieldId];
    }

    return allFields.filter((field) => field.groupId === groupId).map((field) => field.id);
  };

  const signField = async (
    fieldId: number,
    fieldValue: TSignEnvelopeFieldValue,
    authOptions?: TRecipientActionAuth,
  ) => {
    const affectedFieldIds = resolveAffectedFieldIds(fieldId);

    setSigningFieldIds((prev) => new Set([...prev, ...affectedFieldIds]));

    try {
      // Set the fields locally for direct templates.
      if (isDirectTemplate) {
        return handleDirectTemplateFieldInsertion(fieldId, fieldValue);
      }

      const { signedFields } = await signEnvelopeField({
        token: envelopeData.recipient.token,
        fieldId,
        fieldValue,
        authOptions,
      });

      return signedFields;
    } finally {
      setSigningFieldIds((prev) => {
        const next = new Set(prev);

        for (const affectedFieldId of affectedFieldIds) {
          next.delete(affectedFieldId);
        }

        return next;
      });
    }
  };

  /**
   * Mirrors the server side signing logic for direct templates, where fields are only
   * held locally until the document is created.
   */
  const handleDirectTemplateFieldInsertion = (fieldId: number, fieldValue: TSignEnvelopeFieldValue) => {
    const foundField = recipient.fields.find((field) => field.id === fieldId);

    if (!foundField) {
      throw new Error('Not possible');
    }

    const groupFields = foundField.groupId
      ? recipient.fields.filter((field) => field.groupId === foundField.groupId && field.type === foundField.type)
      : [foundField];

    const fieldInsertionValues: FieldInsertionValues[] = match({
      type: foundField.type,
      isGrouped: Boolean(foundField.groupId),
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
        if (fieldValue.type !== FieldType.CHECKBOX) {
          throw new Error('Not possible');
        }

        return extractGroupedCheckboxInsertionValues({
          fields: groupFields,
          selectedFieldId: foundField.id,
          selectedIndices: fieldValue.value,
        });
      })
      .otherwise(() => {
        const insertionValues = extractFieldInsertionValues({
          fieldValue,
          field: foundField,
          documentMeta: envelope.documentMeta,
        });

        // Fields in the same group act as a single field, so the value is applied to every field.
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
        requiredRecipientFields,
        nextRecipient,

        otherRecipientCompletedFields,
        assistantRecipients,
        assistantFields,
        setSelectedAssistantRecipientId,
        selectedAssistantRecipient,
        selectedAssistantRecipientFields,

        signingFieldIds,
        signField,
      }}
    >
      {children}
    </EnvelopeSigningContext.Provider>
  );
};

EnvelopeSigningProvider.displayName = 'EnvelopeSigningProvider';
