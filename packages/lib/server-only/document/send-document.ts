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
import pMap from 'p-map';
import { isDeepEqual } from 'remeda';

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
import { assertEnvelopeContentLimits, getContentsMissingImages } from '../../utils/envelope-content';
import { assertFieldGroupsValid, groupFieldsByGroupId } from '../../utils/field-groups';
import { toCheckboxCustomText, toRadioCustomText } from '../../utils/fields';
import { getRecipientsInActiveSigningStep } from '../../utils/recipient-groups';
import { getRecipientsWithMissingFields, isRecipientEmailValidForSending } from '../../utils/recipients';
import { loadContentImages } from '../data-content/load-content-images';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { lockEnvelope } from '../envelope/lock-envelope';
import {
  commitRenderedEnvelopeItems,
  RENDER_CONTENTS_CONCURRENCY,
  type RenderedEnvelopeItem,
  renderContentsIntoEnvelopeItem,
} from '../envelope-content/insert-contents-into-envelope-item';
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
      contents: {
        select: {
          id: true,
          dataContentId: true,
          contentMeta: true,
          envelopeItemId: true,
        },
      },
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
          name: true,
          organisation: {
            select: {
              id: true,
              type: true,
              name: true,
              organisationClaim: {
                select: {
                  recipientCount: true,
                  originalSubscriptionClaimId: true,
                  envelopeContentCount: true,
                  envelopeContentImageCount: true,
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

  // An image content without an image renders nothing, so the document would
  // silently ship without it.
  const contentsMissingImages = getContentsMissingImages(envelope.contents);

  if (contentsMissingImages.length > 0) {
    throw new AppError('MISSING_CONTENT_IMAGE', {
      message: `The following contents have no image attached: ${contentsMissingImages.map((content) => content.id).join(', ')}.`,
      statusCode: 400,
    });
  }

  assertEnvelopeContentLimits(
    envelope.contents.map((content) => content.contentMeta.type),
    envelope.team.organisation.organisationClaim,
  );

  assertRecipientsHaveRequiredFields(envelope);

  const recipientsToNotify = getSigningRequestRecipients({ envelope, sendEmail });

  if (!bypassAdminRules) {
    await assertAdminRulesAllowSend({ envelope, sender, recipientsToNotify, requestMetadata });
  }

  // The items are only pointed at the rendered copies inside the transaction
  // that moves the envelope on from DRAFT, so a failure anywhere before that
  // leaves every item on its original file rather than some on a rendered one
  // which the next send would render onto again.
  let renderedEnvelopeItems: RenderedEnvelopeItem[] = [];

  if (envelope.status === DocumentStatus.DRAFT && envelope.contents.length > 0) {
    const images = await loadContentImages(envelope.contents);

    const results = await pMap(
      envelope.envelopeItems,
      async (envelopeItem) =>
        renderContentsIntoEnvelopeItem({
          envelopeItemId: envelopeItem.id,
          contents: envelope.contents.filter((content) => content.envelopeItemId === envelopeItem.id),
          images,
        }),
      { concurrency: RENDER_CONTENTS_CONCURRENCY },
    );

    renderedEnvelopeItems = results.filter((result): result is RenderedEnvelopeItem => result !== null);
  }

  const allRecipientsHaveNoActionToTake = envelope.recipients.every(
    (recipient) => recipient.role === RecipientRole.CC || recipient.signingStatus === SigningStatus.SIGNED,
  );

  if (allRecipientsHaveNoActionToTake) {
    // Nobody is left to act, so the send transaction below is skipped and the
    // rendered items have to be committed here before sealing.
    if (envelope.status === DocumentStatus.DRAFT) {
      await prisma.$transaction(async (tx) => {
        await commitRenderedEnvelopeItems(tx, {
          envelopeId: envelope.id,
          contents: envelope.contents,
          renderedEnvelopeItems,
        });

        const lockedEnvelope = await lockEnvelope(tx, envelope.id);

        assertStatusUnchangedSinceRead(envelope, lockedEnvelope.status);

        const lockedRecipients = await tx.recipient.findMany({
          where: {
            envelopeId: envelope.id,
          },
        });

        assertRecipientsUnchangedSinceRead(envelope, lockedRecipients);

        await tx.envelope.update({
          where: {
            id: envelope.id,
          },
          data: {
            status: DocumentStatus.PENDING,
          },
        });
      });
    }

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

  // Fails fast before the slow work below. The values come from the re-run under the lock.
  resolveFieldsToAutoInsert(envelope);

  if (isTspEnvelope(envelope) && envelope.status === DocumentStatus.DRAFT) {
    await materializeTspAnchorsForEnvelope({
      envelopeId: envelope.id,
      documentDataOverrides: Object.fromEntries(
        renderedEnvelopeItems.map((item) => [item.envelopeItemId, item.documentData]),
      ),
    });
  }

  const updatedEnvelope = await prisma.$transaction(async (tx) => {
    if (envelope.status === DocumentStatus.DRAFT) {
      await commitRenderedEnvelopeItems(tx, {
        envelopeId: envelope.id,
        contents: envelope.contents,
        renderedEnvelopeItems,
      });
    }

    // For a draft, `commitRenderedEnvelopeItems` above has already taken this lock first.
    const { status: lockedStatus } = await lockEnvelope(tx, envelope.id);

    assertStatusUnchangedSinceRead(envelope, lockedStatus);

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

    const lockedEnvelope = await tx.envelope.findFirstOrThrow({
      where: {
        id: envelope.id,
      },
      select: {
        internalVersion: true,
        recipients: true,
        fields: true,
      },
    });

    assertRecipientsUnchangedSinceRead(envelope, lockedEnvelope.recipients);

    assertRecipientsHaveRequiredFields(lockedEnvelope);

    const fieldsToAutoInsert = resolveFieldsToAutoInsert(lockedEnvelope);

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

const assertStatusUnchangedSinceRead = (envelope: Pick<Envelope, 'id' | 'status'>, lockedStatus: DocumentStatus) => {
  if (lockedStatus !== envelope.status) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Document ${envelope.id} was changed by another request while it was being sent, try again`,
      statusCode: 409,
    });
  }
};

/**
 * Who is emailed, the auth checks and the admin rules are all decided from the read made before
 * the lock, since the admin rules are too slow to run under it.
 */
const assertRecipientsUnchangedSinceRead = (
  envelope: Pick<Envelope, 'id'> & { recipients: Recipient[] },
  lockedRecipients: Recipient[],
) => {
  const toSendDecisionInput = (recipient: Recipient) => ({
    id: recipient.id,
    email: recipient.email,
    role: recipient.role,
    signingOrder: recipient.signingOrder,
    signingStatus: recipient.signingStatus,
    authOptions: recipient.authOptions,
  });

  const sortById = (recipients: Recipient[]) =>
    [...recipients].sort((a, b) => a.id - b.id).map((recipient) => toSendDecisionInput(recipient));

  if (!isDeepEqual(sortById(envelope.recipients), sortById(lockedRecipients))) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Document ${envelope.id} was changed by another request while it was being sent, try again`,
      statusCode: 409,
    });
  }
};

type SendFieldsSnapshot = Pick<Envelope, 'internalVersion'> & {
  recipients: Recipient[];
  fields: Field[];
};

const assertRecipientsHaveRequiredFields = ({ recipients, fields }: SendFieldsSnapshot) => {
  const recipientsWithMissingFields = getRecipientsWithMissingFields(recipients, fields);

  if (recipientsWithMissingFields.length > 0) {
    const missingRecipientDescriptions = recipientsWithMissingFields
      .map((r) => (r.name ? `${r.name} (${r.email}, id: ${r.id})` : `${r.email} (id: ${r.id})`))
      .join(', ');

    throw new AppError(AppErrorCode.MISSING_SIGNATURE_FIELD, {
      message: `The following recipients are missing required fields: ${missingRecipientDescriptions}. Signers must have at least one signature field.`,
    });
  }
};

const resolveFieldsToAutoInsert = ({ internalVersion, recipients, fields }: SendFieldsSnapshot) => {
  const fieldsToAutoInsert: { fieldId: number; customText: string }[] = [];

  if (internalVersion !== 2) {
    return fieldsToAutoInsert;
  }

  // Grouped fields must be in a valid state before the document can be sent.
  assertFieldGroupsValid(fields);

  const hasFieldWithoutRecipient = fields.some(
    (field) => !recipients.some((recipient) => recipient.id === field.recipientId),
  );

  if (hasFieldWithoutRecipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found',
    });
  }

  for (const recipient of recipients) {
    const recipientFields = fields.filter((field) => field.recipientId === recipient.id);

    // Run for every recipient, since it also validates the field settings.
    const recipientAutoInsertValues = extractRecipientAutoInsertValues(recipientFields, recipient);

    // Only auto-insert fields if the recipient has not been sent the document yet.
    if (recipient.sendStatus !== SendStatus.SENT) {
      fieldsToAutoInsert.push(...recipientAutoInsertValues);
    }
  }

  return fieldsToAutoInsert;
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

  const { documentData: newDocumentData } = await putNormalizedPdfFileServerSide({
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
 * The values to auto insert into a recipient's fields, such as their email or pre-checked
 * options, when the fields are first shown to them.
 *
 * Radio and checkbox fields are resolved as a whole group, since pre-checked options and
 * validation rules count across every field in it. An ungrouped one is a group of one.
 */
export const extractRecipientAutoInsertValues = (
  fields: Field[],
  recipient: Pick<Recipient, 'id' | 'email'>,
): { fieldId: number; customText: string }[] => {
  const autoInsertValues: { fieldId: number; customText: string }[] = [];

  for (const field of fields) {
    // Backup check.
    if (field.recipientId !== recipient.id) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Mismatch between field recipient ID and passed in recipient ID`,
      });
    }

    // Run for every field, including radio and checkbox, since it also validates the meta.
    const autoInsertValue = extractFieldAutoInsertValues(field, recipient);

    if (autoInsertValue) {
      autoInsertValues.push(autoInsertValue);
    }
  }

  const radioAndCheckboxFields = fields.filter(
    (field) => field.type === FieldType.RADIO || field.type === FieldType.CHECKBOX,
  );

  const radioAndCheckboxGroups = [
    ...groupFieldsByGroupId(radioAndCheckboxFields).values(),
    ...radioAndCheckboxFields.filter((field) => !field.groupId).map((field) => [field]),
  ];

  for (const items of radioAndCheckboxGroups) {
    autoInsertValues.push(...extractGroupedOptionFieldAutoInsertValues(items));
  }

  return autoInsertValues;
};

/**
 * Extracts the auto insertion values for a given field. Radio and checkbox fields are
 * resolved as a group by `extractGroupedOptionFieldAutoInsertValues` instead.
 *
 * If field is not auto insertable, returns `null`.
 */
const extractFieldAutoInsertValues = (
  unknownField: Field,
  recipient: Pick<Recipient, 'email'>,
): { fieldId: number; customText: string } | null => {
  const parsedField = ZFieldAndMetaSchema.safeParse(unknownField);

  if (parsedField.error) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `One or more fields have invalid metadata. Error: ${parsedField.error.message}`,
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

  return null;
};

/**
 * Extracts the auto insertion values for a group of radio or checkbox fields.
 *
 * Pre-checked options are counted across the group. If the group should be auto
 * inserted, every field is returned so the whole group is inserted together,
 * with fields that have no checked options receiving an empty value.
 *
 * Returns an empty list if the group should not be auto inserted.
 */
const extractGroupedOptionFieldAutoInsertValues = (items: Field[]): { fieldId: number; customText: string }[] => {
  const [firstItem] = items;

  if (!firstItem) {
    return [];
  }

  if (firstItem.type === FieldType.RADIO) {
    const itemWithCheckedOption = items.find((item) => {
      const { values = [] } = ZRadioFieldMeta.parse(item.fieldMeta);

      return values.some((value) => value.checked);
    });

    if (!itemWithCheckedOption) {
      return [];
    }

    return items.map((item) => {
      if (item.id !== itemWithCheckedOption.id) {
        return {
          fieldId: item.id,
          customText: '',
        };
      }

      const { values = [] } = ZRadioFieldMeta.parse(item.fieldMeta);

      return {
        fieldId: item.id,
        customText: toRadioCustomText(values.findIndex((value) => value.checked)),
      };
    });
  }

  if (firstItem.type === FieldType.CHECKBOX) {
    const { validationRule, validationLength } = ZCheckboxFieldMeta.parse(firstItem.fieldMeta);

    const validation = checkboxValidationSigns.find((sign) => sign.label === validationRule);

    // Checked before counting the pre-checked options, so an unknown rule is rejected
    // even when nothing is pre-checked.
    if (validationRule && validationLength && !validation) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Invalid checkbox validation rule',
      });
    }

    const itemCheckedIndices = items.map((item) => {
      const { values = [] } = ZCheckboxFieldMeta.parse(item.fieldMeta);

      return values.flatMap((value, index) => (value.checked ? [index] : []));
    });

    const totalCheckedCount = itemCheckedIndices.reduce((total, indices) => total + indices.length, 0);

    if (totalCheckedCount === 0) {
      return [];
    }

    if (
      validation &&
      validationLength &&
      !validateCheckboxLength(totalCheckedCount, validation.value, validationLength)
    ) {
      return [];
    }

    return items.map((item, index) => ({
      fieldId: item.id,
      customText: itemCheckedIndices[index].length > 0 ? toCheckboxCustomText(itemCheckedIndices[index]) : '',
    }));
  }

  return [];
};
