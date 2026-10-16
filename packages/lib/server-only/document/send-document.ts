import { AdminRuleEngine } from '@documenso/ee/server-only/admin-rules/admin-rule-engine';
import type {
  AdminRuleEventEnvelope,
  AdminRuleEventUser,
} from '@documenso/ee/server-only/admin-rules/admin-rule-event';
import { materializeTspAnchorsForEnvelope } from '@documenso/ee/server-only/signing/csc/materialize-anchors';
import { resolveExpiresAt } from '@documenso/lib/constants/envelope-expiration';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { checkboxValidationSigns } from '@documenso/ui/primitives/document-flow/field-items-advanced-settings/constants';
import type { DocumentData, DocumentMeta, Envelope, EnvelopeItem, Field, Recipient } from '@prisma/client';
import {
  DocumentSigningOrder,
  DocumentStatus,
  EnvelopeType,
  FieldType,
  RecipientRole,
  SendStatus,
  SigningStatus,
  WebhookTriggerEvents,
} from '@prisma/client';

import { validateCheckboxLength } from '../../advanced-fields-validation/validate-checkbox';
import { DIRECT_TEMPLATE_RECIPIENT_EMAIL } from '../../constants/direct-templates';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { jobs } from '../../jobs/client';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import {
  ZCheckboxFieldMeta,
  ZDropdownFieldMeta,
  ZFieldAndMetaSchema,
  ZNumberFieldMeta,
  ZRadioFieldMeta,
  ZTextFieldMeta,
} from '../../types/field-meta';
import { isTspEnvelope } from '../../types/signature-level';
import { mapEnvelopeToWebhookDocumentPayload, ZWebhookDocumentSchema } from '../../types/webhook-payload';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putNormalizedPdfFileServerSide } from '../../universal/upload/put-file.server';
import { isDocumentCompleted } from '../../utils/document';
import { extractDocumentAuthMethods } from '../../utils/document-auth';
import { type EnvelopeIdOptions, mapSecondaryIdToDocumentId } from '../../utils/envelope';
import { toCheckboxCustomText, toRadioCustomText } from '../../utils/fields';
import { getRecipientsInActiveSigningStep } from '../../utils/recipient-groups';
import { getRecipientsWithMissingFields, isRecipientEmailValidForSending } from '../../utils/recipients';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { insertFormValuesInPdf } from '../pdf/insert-form-values-in-pdf';
import { assertUserNotDisabled } from '../user/assert-user-not-disabled';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type SendDocumentOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
  sendEmail?: boolean;
  /**
   * Skips the admin rules here, for callers that already ran them for this document, as direct links
   * do. The signing email jobs still check each email when they send it.
   */
  bypassAdminRules?: boolean;
  requestMetadata: ApiRequestMetadata;
};

export const sendDocument = async ({
  id,
  userId,
  teamId,
  sendEmail,
  bypassAdminRules,
  requestMetadata,
}: SendDocumentOptions) => {
  // One lookup for both the disabled check and the sender the admin rules see.
  const sender = await prisma.user.findFirst({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      twoFactorEnabled: true,
      disabled: true,
    },
  });

  if (!sender) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'User not found',
      statusCode: 404,
    });
  }

  // Refuse to send on behalf of a disabled account. Guards distribute /
  // redistribute / template-use routes, the bulk-send job, and direct
  // templates that auto-send on creation.
  assertUserNotDisabled(sender);

  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      recipients: {
        orderBy: [{ signingOrder: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      },
      fields: true,
      documentMeta: true,
      envelopeItems: {
        select: {
          id: true,
          documentData: {
            select: {
              type: true,
              id: true,
              data: true,
              initialData: true,
            },
          },
        },
      },
      team: {
        select: {
          id: true,
          url: true,
          organisation: {
            select: {
              id: true,
              type: true,
              organisationClaim: {
                select: {
                  recipientCount: true,
                  originalSubscriptionClaimId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!envelope) {
    throw new Error('Document not found');
  }

  if (envelope.recipients.length === 0) {
    throw new Error('Document has no recipients');
  }

  // A recipientCount of 0 means unlimited recipients are allowed.
  const maximumRecipientCount = envelope.team.organisation.organisationClaim.recipientCount;

  if (maximumRecipientCount > 0 && envelope.recipients.length > maximumRecipientCount) {
    throw new AppError('RECIPIENT_LIMIT_EXCEEDED', {
      message: `You cannot send a document with more than ${maximumRecipientCount} recipients`,
      statusCode: 400,
    });
  }

  if (isDocumentCompleted(envelope.status)) {
    throw new Error('Can not send completed document');
  }

  const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

  const signingOrder = envelope.documentMeta?.signingOrder || DocumentSigningOrder.PARALLEL;

  if (isTspEnvelope(envelope) && signingOrder === DocumentSigningOrder.PARALLEL && envelope.documentMeta) {
    console.warn(
      `[CSC] Coercing signingOrder=PARALLEL → SEQUENTIAL for ${envelope.signatureLevel} envelope ${envelope.id} at send time. The schema-layer guard should have caught this earlier.`,
    );

    await prisma.documentMeta.update({
      where: {
        id: envelope.documentMeta.id,
      },
      data: {
        signingOrder: DocumentSigningOrder.SEQUENTIAL,
      },
    });

    envelope.documentMeta.signingOrder = DocumentSigningOrder.SEQUENTIAL;
  }

  if (envelope.envelopeItems.length === 0) {
    throw new Error('Missing envelope items');
  }

  if (envelope.formValues && envelope.status === DocumentStatus.DRAFT) {
    await Promise.all(
      envelope.envelopeItems.map(async (envelopeItem) => {
        await injectFormValuesIntoDocument(envelope, envelopeItem);
      }),
    );
  }

  // Validate that recipients with auth requirements have a valid email.
  envelope.recipients.forEach((recipient) => {
    const auth = extractDocumentAuthMethods({
      documentAuth: envelope.authOptions,
      recipientAuth: recipient.authOptions,
    });

    if (
      recipient.role !== RecipientRole.CC &&
      (auth.recipientAccessAuthRequired || auth.recipientActionAuthRequired) &&
      !isRecipientEmailValidForSending(recipient)
    ) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Recipient ${recipient.id} requires an email because they have auth requirements.`,
      });
    }
  });

  // Validate that recipients who require fields (e.g., signers need signature fields) have them.
  const recipientsWithMissingFields = getRecipientsWithMissingFields(envelope.recipients, envelope.fields);

  if (recipientsWithMissingFields.length > 0) {
    const missingRecipientDescriptions = recipientsWithMissingFields
      .map((r) => (r.name ? `${r.name} (${r.email}, id: ${r.id})` : `${r.email} (id: ${r.id})`))
      .join(', ');

    throw new AppError(AppErrorCode.MISSING_SIGNATURE_FIELD, {
      message: `The following recipients are missing required fields: ${missingRecipientDescriptions}. Signers must have at least one signature field.`,
    });
  }

  const recipientsToNotify = getSigningRequestRecipients({ envelope, sendEmail });

  if (!bypassAdminRules) {
    await assertAdminRulesAllowSend({ envelope, sender, recipientsToNotify, requestMetadata });
  }

  const allRecipientsHaveNoActionToTake = envelope.recipients.every(
    (recipient) => recipient.role === RecipientRole.CC || recipient.signingStatus === SigningStatus.SIGNED,
  );

  if (allRecipientsHaveNoActionToTake) {
    await jobs.triggerJob({
      name: 'internal.seal-document',
      payload: {
        documentId: legacyDocumentId,
        requestMetadata: requestMetadata?.requestMetadata,
      },
    });

    // Keep the return type the same for the `sendDocument` method
    return await prisma.envelope.findFirstOrThrow({
      where: {
        id: envelope.id,
      },
      include: {
        documentMeta: true,
        recipients: true,
      },
    });
  }

  const fieldsToAutoInsert: { fieldId: number; customText: string }[] = [];

  // Validate and autoinsert fields for V2 envelopes.
  if (envelope.internalVersion === 2) {
    for (const unknownField of envelope.fields) {
      const recipient = envelope.recipients.find((r) => r.id === unknownField.recipientId);

      if (!recipient) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Recipient not found',
        });
      }

      const fieldToAutoInsert = extractFieldAutoInsertValues(unknownField, recipient);

      // Only auto-insert fields if the recipient has not been sent the document yet.
      if (fieldToAutoInsert && recipient.sendStatus !== SendStatus.SENT) {
        fieldsToAutoInsert.push(fieldToAutoInsert);
      }
    }
  }

  if (isTspEnvelope(envelope) && envelope.status === DocumentStatus.DRAFT) {
    await materializeTspAnchorsForEnvelope({
      envelopeId: envelope.id,
    });
  }

  const updatedEnvelope = await prisma.$transaction(async (tx) => {
    if (envelope.status === DocumentStatus.DRAFT) {
      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT,
          envelopeId: envelope.id,
          metadata: requestMetadata,
          data: {},
        }),
      });
    }

    if (envelope.internalVersion === 2) {
      const autoInsertedFields = await Promise.all(
        fieldsToAutoInsert.map(async (field) => {
          // Warning: Only auto-insert fields if the recipient has not been sent the document yet.
          return await tx.field.update({
            where: {
              id: field.fieldId,
            },
            data: {
              customText: field.customText,
              inserted: true,
            },
          });
        }),
      );

      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELDS_AUTO_INSERTED,
          envelopeId: envelope.id,
          data: {
            fields: autoInsertedFields.map((field) => ({
              fieldId: field.id,
              fieldType: field.type,
              recipientId: field.recipientId,
            })),
          },
          // Don't put metadata or user here since it's a system event.
        }),
      });
    }

    const expiresAt = resolveExpiresAt(envelope.documentMeta?.envelopeExpirationPeriod ?? null);

    // Set expiresAt on each recipient that hasn't already signed/rejected.
    // Exclude CC recipients since they don't sign and shouldn't be subject to expiry.
    if (expiresAt) {
      await tx.recipient.updateMany({
        where: {
          envelopeId: envelope.id,
          signingStatus: {
            notIn: [SigningStatus.SIGNED, SigningStatus.REJECTED],
          },
          role: {
            not: RecipientRole.CC,
          },
        },
        data: {
          expiresAt,
          expirationNotifiedAt: null,
        },
      });
    }

    return await tx.envelope.update({
      where: {
        id: envelope.id,
      },
      data: {
        status: DocumentStatus.PENDING,
      },
      include: {
        documentMeta: true,
        recipients: true,
      },
    });
  });

  await Promise.all(
    recipientsToNotify.map(async (recipient) => {
      await jobs.triggerJob({
        name: 'send.signing.requested.email',
        payload: {
          userId,
          documentId: legacyDocumentId,
          recipientId: recipient.id,
          requestMetadata: requestMetadata?.requestMetadata,
        },
      });
    }),
  );

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_SENT,
    data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(updatedEnvelope)),
    userId,
    teamId,
  });

  return updatedEnvelope;
};

type SigningRequestRecipient = Pick<Recipient, 'role' | 'signingOrder' | 'signingStatus' | 'sendStatus'>;

type GetSigningRequestRecipientsOptions<T extends SigningRequestRecipient> = {
  envelope: Pick<Envelope, 'signatureLevel'> & {
    recipients: T[];
    documentMeta: Pick<DocumentMeta, 'signingOrder' | 'emailSettings' | 'distributionMethod'> | null;
  };
  sendEmail?: boolean;
};

/**
 * The recipients `sendDocument` emails a signing request to: those in the active signing step who
 * haven't been sent one. Empty when signing request emails are off.
 */
export const getSigningRequestRecipients = <T extends SigningRequestRecipient>({
  envelope,
  sendEmail,
}: GetSigningRequestRecipientsOptions<T>) => {
  const isRecipientSigningRequestEmailEnabled = extractDerivedDocumentEmailSettings(
    envelope.documentMeta,
  ).recipientSigningRequest;

  // Only send email if one of the following is true:
  // - It is explicitly set
  // - The email is enabled for signing requests AND sendEmail is undefined
  const shouldSendEmails = sendEmail || (isRecipientSigningRequestEmailEnabled && sendEmail === undefined);

  if (!shouldSendEmails) {
    return [];
  }

  const recipientsInActiveStep =
    envelope.documentMeta?.signingOrder === DocumentSigningOrder.SEQUENTIAL
      ? getRecipientsInActiveSigningStep(envelope.recipients, {
          strictlySequential: isTspEnvelope(envelope),
        })
      : envelope.recipients;

  return recipientsInActiveStep.filter(
    (recipient) => recipient.sendStatus !== SendStatus.SENT && recipient.role !== RecipientRole.CC,
  );
};

type AssertAdminRulesAllowSendOptions = {
  envelope: AdminRuleEventEnvelope;
  sender: AdminRuleEventUser;
  recipientsToNotify: Pick<Recipient, 'email'>[];
  requestMetadata: ApiRequestMetadata;
};

/**
 * Runs the "Document sent" rules, then the "Email sent" rules for the signing requests about to go
 * out, and throws `ADMIN_RULE_BLOCKED` if either blocks. A rule that turns off the organisation's
 * emails needs no handling here: the signing email jobs check that setting when they run.
 */
export const assertAdminRulesAllowSend = async ({
  envelope,
  sender,
  recipientsToNotify,
  requestMetadata,
}: AssertAdminRulesAllowSendOptions) => {
  const adminRuleEngine = new AdminRuleEngine({
    requestMetadata: requestMetadata.requestMetadata,
    requestSource: requestMetadata.source,
  });

  await adminRuleEngine.runAndAssert({ trigger: 'DOCUMENT_SENT', envelope, sender });

  // Recipients without an email address aren't emailed, so the "Email sent" rules leave them out.
  const recipientsToEmail = recipientsToNotify.filter((recipient) => isRecipientEmailValidForSending(recipient));

  if (recipientsToEmail.length === 0) {
    return;
  }

  await adminRuleEngine.runAndAssert({
    trigger: 'EMAIL_SENT',
    envelope,
    sender,
    emailType: 'signing_request',
    recipients: recipientsToEmail,
  });
};

const injectFormValuesIntoDocument = async (
  envelope: Envelope,
  envelopeItem: Pick<EnvelopeItem, 'id'> & { documentData: DocumentData },
) => {
  const file = await getFileServerSide(envelopeItem.documentData);

  const prefilled = await insertFormValuesInPdf({
    pdf: Buffer.from(file),
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    formValues: envelope.formValues as Record<string, string | number | boolean>,
  });

  let fileName = envelope.title;

  if (!envelope.title.endsWith('.pdf')) {
    fileName = `${envelope.title}.pdf`;
  }

  const newDocumentData = await putNormalizedPdfFileServerSide({
    name: fileName,
    type: 'application/pdf',
    arrayBuffer: async () => Promise.resolve(prefilled),
  });

  await prisma.envelopeItem.update({
    where: {
      id: envelopeItem.id,
    },
    data: {
      documentDataId: newDocumentData.id,
    },
  });
};

/**
 * Extracts the auto insertion values for a given field.
 *
 * If field is not auto insertable, returns `null`.
 */
export const extractFieldAutoInsertValues = (
  unknownField: Field,
  recipient: Pick<Recipient, 'email'>,
): { fieldId: number; customText: string } | null => {
  const parsedField = ZFieldAndMetaSchema.safeParse(unknownField);

  if (parsedField.error) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'One or more fields have invalid metadata. Error: ' + parsedField.error.message,
    });
  }

  const field = parsedField.data;
  const fieldId = unknownField.id;

  // Auto insert email fields if the recipient has a valid email.
  if (
    field.type === FieldType.EMAIL &&
    isRecipientEmailValidForSending(recipient) &&
    recipient.email !== DIRECT_TEMPLATE_RECIPIENT_EMAIL
  ) {
    return {
      fieldId,
      customText: recipient.email,
    };
  }

  // Auto insert text fields with prefilled values.
  if (field.type === FieldType.TEXT) {
    const { text } = ZTextFieldMeta.parse(field.fieldMeta);

    if (text) {
      return {
        fieldId,
        customText: text,
      };
    }
  }

  // Auto insert number fields with prefilled values.
  if (field.type === FieldType.NUMBER) {
    const { value } = ZNumberFieldMeta.parse(field.fieldMeta);

    if (value) {
      return {
        fieldId,
        customText: value,
      };
    }
  }

  // Auto insert radio fields with the pre-checked value.
  if (field.type === FieldType.RADIO) {
    const { values = [] } = ZRadioFieldMeta.parse(field.fieldMeta);

    const checkedItemIndex = values.findIndex((value) => value.checked);

    if (checkedItemIndex !== -1) {
      return {
        fieldId,
        customText: toRadioCustomText(checkedItemIndex),
      };
    }
  }

  // Auto insert dropdown fields with the default value.
  if (field.type === FieldType.DROPDOWN) {
    const { defaultValue, values = [] } = ZDropdownFieldMeta.parse(field.fieldMeta);

    if (defaultValue && values.some((value) => value.value === defaultValue)) {
      return {
        fieldId,
        customText: defaultValue,
      };
    }
  }

  // Auto insert checkbox fields with the pre-checked values.
  if (field.type === FieldType.CHECKBOX) {
    const { values = [], validationRule, validationLength } = ZCheckboxFieldMeta.parse(field.fieldMeta);

    const checkedIndices: number[] = [];

    values.forEach((value, i) => {
      if (value.checked) {
        checkedIndices.push(i);
      }
    });

    let isValid = true;

    if (validationRule && validationLength) {
      const validation = checkboxValidationSigns.find((sign) => sign.label === validationRule);

      if (!validation) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'Invalid checkbox validation rule',
        });
      }

      isValid = validateCheckboxLength(checkedIndices.length, validation.value, validationLength);
    }

    if (isValid && checkedIndices.length > 0) {
      return {
        fieldId,
        customText: toCheckboxCustomText(checkedIndices),
      };
    }
  }

  return null;
};
