import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { isBase64Image } from '@documenso/lib/constants/signatures';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '@documenso/lib/constants/time-zones';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import type { EnvelopeForSigningResponse } from '@documenso/lib/server-only/envelope/get-envelope-for-recipient-signing';
import type { TCssVarsSchema } from '@documenso/lib/types/css-vars';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { DocumentAuth } from '@documenso/lib/types/document-auth';
import { isFieldUnsignedAndRequired, isRequiredField } from '@documenso/lib/utils/advanced-fields-helpers';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { extractFieldInsertionValues } from '@documenso/lib/utils/envelope-signing';
import { getNextDictatableRecipient } from '@documenso/lib/utils/recipient-groups';
import { isRecipientBefore } from '@documenso/lib/utils/recipients';
import { trpc } from '@documenso/trpc/react';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { EnvelopeType, type Field, FieldType, type Recipient, RecipientRole, SigningStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { createContext, useContext, useMemo, useState } from 'react';
import { prop, sortBy } from 'remeda';

export type EnvelopeSigningContextValue = {
  isDirectTemplate: boolean;

  fullName: string;
  setFullName: (_value: string) => void;
  email: string;
  setEmail: (_value: string) => void;
  signature: string | null;
  setSignature: (_value: string | null) => void;
  profileSignature: string | null;
  hasCompletedSignatureActionAuth: boolean;
  markSignatureActionAuthCompleted: () => void;
  recipientActionAuthRequired: boolean;

  showPendingFieldTooltip: boolean;
  setShowPendingFieldTooltip: (_value: boolean) => void;

  envelopeData: EnvelopeForSigningResponse;
  envelope: EnvelopeForSigningResponse['envelope'];

  recipient: EnvelopeForSigningResponse['recipient'];
  recipientFieldsRemaining: Field[];
  recipientFields: Field[];
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

  signingFieldHighlightColors: TCssVarsSchema | null;

  signField: (
    _fieldId: number,
    _value: TSignEnvelopeFieldValue,
    authOptions?: TRecipientActionAuth,
  ) => Promise<Pick<Field, 'id' | 'inserted'>>;
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
  signingFieldHighlightColors?: TCssVarsSchema | null;
  children: React.ReactNode;
}

/**
 * Inject prefilled date fields for the current recipient.
 *
 * Only prefills date fields that are marked as readOnly by the editor.
 * Editable date fields with a preset value will show the value but remain editable.
 */
const prefillDateFields = (data: EnvelopeForSigningResponse): EnvelopeForSigningResponse => {
  const { timezone, dateFormat } = data.envelope.documentMeta;

  const prefillField = <T extends { type: FieldType; inserted: boolean; customText: string; fieldMeta: unknown }>(
    field: T,
  ): T => {
    if (field.type !== FieldType.DATE || field.inserted) {
      return field;
    }

    const meta = typeof field.fieldMeta === 'object' && field.fieldMeta !== null ? field.fieldMeta : {};
    const fieldReadOnly = 'readOnly' in meta && meta.readOnly === true;
    const fieldValue = 'value' in meta && typeof meta.value === 'string' ? meta.value : '';

    if (!fieldReadOnly) {
      return field;
    }

    const formattedDate = fieldValue
      ? DateTime.fromISO(fieldValue)
          .setZone(timezone ?? DEFAULT_DOCUMENT_TIME_ZONE)
          .toFormat(dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT)
      : DateTime.now()
          .setZone(timezone ?? DEFAULT_DOCUMENT_TIME_ZONE)
          .toFormat(dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT);

    return {
      ...field,
      customText: formattedDate,
      inserted: true,
      fieldMeta: {
        ...meta,
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
  signingFieldHighlightColors = null,
  children,
}: EnvelopeSigningProviderProps) => {
  const [envelopeData, setEnvelopeData] = useState(() => prefillDateFields(initialEnvelopeData));

  const { envelope, recipient } = envelopeData;

  const [fullName, setFullName] = useState(initialFullName || '');
  const [email, setEmail] = useState(initialEmail || '');

  const [showPendingFieldTooltip, setShowPendingFieldTooltip] = useState(false);
  const [hasCompletedSignatureActionAuth, setHasCompletedSignatureActionAuth] = useState(false);

  const isDirectTemplate = envelope.type === EnvelopeType.TEMPLATE;

  const { derivedRecipientActionAuth, recipientActionAuthRequired } = useMemo(
    () =>
      extractDocumentAuthMethods({
        documentAuth: envelope.authOptions,
        recipientAuth: recipient.authOptions,
      }),
    [envelope.authOptions, recipient.authOptions],
  );

  const { mutateAsync: signEnvelopeField } = trpc.envelope.field.sign.useMutation({
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    onSuccess: (data) => {
      setEnvelopeData((prev) => ({
        ...prev,
        envelope: {
          ...prev.envelope,
          recipients: prev.envelope.recipients.map((recipient) =>
            recipient.id === data.signedField.recipientId
              ? {
                  ...recipient,
                  fields: recipient.fields.map((field) =>
                    field.id === data.signedField.id ? data.signedField : field,
                  ),
                }
              : recipient,
          ),
        },
        recipient: {
          ...prev.recipient,
          fields: prev.recipient.fields.map((field) => (field.id === data.signedField.id ? data.signedField : field)),
        },
      }));
    },
  });

  const profileSignature = useMemo(() => {
    const sig = initialSignature || '';
    const isBase64 = isBase64Image(sig);

    if (isBase64 && (envelope.documentMeta.uploadSignatureEnabled || envelope.documentMeta.drawSignatureEnabled)) {
      return sig;
    }

    if (!isBase64 && sig && envelope.documentMeta.typedSignatureEnabled) {
      return sig;
    }

    return null;
  }, [initialSignature, envelope.documentMeta]);

  // Sidebar default suggestion only — not auto-applied to signature fields.
  const [signature, setSignature] = useState(profileSignature);

  const markSignatureActionAuthCompleted = () => {
    setHasCompletedSignatureActionAuth(true);
  };

  /**
   * The fields that are still required to be signed by the actual recipient.
   */
  const recipientFieldsRemaining = useMemo(() => {
    const requiredFields = envelopeData.recipient.fields
      .filter((field) => isFieldUnsignedAndRequired(field))
      .map((field) => {
        const envelopeItem = envelope.envelopeItems.find((item) => item.id === field.envelopeItemId);

        if (!envelopeItem) {
          throw new Error('Missing envelope item');
        }

        return {
          ...field,
          envelopeItemOrder: envelopeItem.order,
        };
      });

    return sortBy(
      requiredFields,
      [prop('envelopeItemOrder'), 'asc'],
      [prop('page'), 'asc'],
      [prop('positionY'), 'asc'],
    );
  }, [envelopeData.recipient.fields]);

  /**
   * All the required fields for the actual recipient.
   */
  const requiredRecipientFields = useMemo(() => {
    return envelopeData.recipient.fields.filter((field) => isRequiredField(field));
  }, [envelopeData.recipient.fields]);

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

  const signField = async (
    fieldId: number,
    fieldValue: TSignEnvelopeFieldValue,
    authOptions?: TRecipientActionAuth,
  ) => {
    // Set the field locally for direct templates.
    if (isDirectTemplate) {
      const signedField = handleDirectTemplateFieldInsertion(fieldId, fieldValue);

      return signedField;
    }

    const { signedField } = await signEnvelopeField({
      token: envelopeData.recipient.token,
      fieldId,
      fieldValue,
      authOptions,
    });

    return signedField;
  };

  const handleDirectTemplateFieldInsertion = (fieldId: number, fieldValue: TSignEnvelopeFieldValue) => {
    const foundField = recipient.fields.find((field) => field.id === fieldId);

    if (!foundField) {
      throw new Error('Not possible');
    }

    const insertionValues = extractFieldInsertionValues({
      fieldValue,
      field: foundField,
      documentMeta: envelope.documentMeta,
    });

    const updatedField = {
      ...foundField,
      ...insertionValues,
    };

    if (fieldValue.type === FieldType.SIGNATURE) {
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

    setEnvelopeData((prev) => ({
      ...prev,
      envelope: {
        ...prev.envelope,
        recipients: prev.envelope.recipients.map((r) =>
          r.id === recipient.id
            ? {
                ...r,
                fields: r.fields.map((field) => (field.id === fieldId ? updatedField : field)),
              }
            : r,
        ),
      },
      recipient: {
        ...prev.recipient,
        fields: prev.recipient.fields.map((field) => (field.id === fieldId ? updatedField : field)),
      },
    }));

    return updatedField;
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
        profileSignature,
        hasCompletedSignatureActionAuth,
        markSignatureActionAuthCompleted,
        recipientActionAuthRequired:
          recipientActionAuthRequired &&
          derivedRecipientActionAuth.length > 0 &&
          !derivedRecipientActionAuth.includes(DocumentAuth.EXPLICIT_NONE),
        envelopeData,
        envelope,

        showPendingFieldTooltip,
        setShowPendingFieldTooltip,

        recipient,
        recipientFieldsRemaining,
        recipientFields,
        requiredRecipientFields,
        nextRecipient,

        otherRecipientCompletedFields,
        assistantRecipients,
        assistantFields,
        setSelectedAssistantRecipientId,
        selectedAssistantRecipient,
        selectedAssistantRecipientFields,

        signingFieldHighlightColors,

        signField,
      }}
    >
      {children}
    </EnvelopeSigningContext.Provider>
  );
};

EnvelopeSigningProvider.displayName = 'EnvelopeSigningProvider';
