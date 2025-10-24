import type { DocumentData, Envelope, EnvelopeItem } from '@prisma/client';
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

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { checkboxValidationSigns } from '@documenso/ui/primitives/document-flow/field-items-advanced-settings/constants';

import { validateCheckboxLength } from '../../advanced-fields-validation/validate-checkbox';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { jobs } from '../../jobs/client';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import { ZCheckboxFieldMeta, ZDropdownFieldMeta, ZRadioFieldMeta } from '../../types/field-meta';
import {
  ZWebhookDocumentSchema,
  mapEnvelopeToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putPdfFileServerSide } from '../../universal/upload/put-file.server';
import { isDocumentCompleted } from '../../utils/document';
import { type EnvelopeIdOptions, mapSecondaryIdToDocumentId } from '../../utils/envelope';
import { toCheckboxCustomText, toRadioCustomText } from '../../utils/fields';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { insertFormValuesInPdf } from '../pdf/insert-form-values-in-pdf';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type SendDocumentOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
  sendEmail?: boolean;
  requestMetadata: ApiRequestMetadata;
};

export const sendDocument = async ({
  id,
  userId,
  teamId,
  sendEmail,
  requestMetadata,
}: SendDocumentOptions) => {
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
    },
  });

  if (!envelope) {
    throw new Error('Document not found');
  }

  if (envelope.recipients.length === 0) {
    throw new Error('Document has no recipients');
  }

  if (isDocumentCompleted(envelope.status)) {
    throw new Error('Can not send completed document');
  }

  const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

  const signingOrder = envelope.documentMeta?.signingOrder || DocumentSigningOrder.PARALLEL;

  let recipientsToNotify = envelope.recipients;

  if (signingOrder === DocumentSigningOrder.SEQUENTIAL) {
    // Get the currently active recipient.
    recipientsToNotify = envelope.recipients
      .filter((r) => r.signingStatus === SigningStatus.NOT_SIGNED && r.role !== RecipientRole.CC)
      .slice(0, 1);

    // Secondary filter so we aren't resending if the current active recipient has already
    // received the envelope.
    recipientsToNotify.filter((r) => r.sendStatus !== SendStatus.SENT);
  }

  if (envelope.envelopeItems.length === 0) {
    throw new Error('Missing envelope items');
  }

  if (envelope.formValues) {
    await Promise.all(
      envelope.envelopeItems.map(async (envelopeItem) => {
        await injectFormValuesIntoDocument(envelope, envelopeItem);
      }),
    );
  }

  // Commented out server side checks for minimum 1 signature per signer now since we need to
  // decide if we want to enforce this for API & templates.
  // const fields = await getFieldsForDocument({
  //   documentId: documentId,
  //   userId: userId,
  // });

  // const fieldsWithSignerEmail = fields.map((field) => ({
  //   ...field,
  //   signerEmail:
  //     envelope.Recipient.find((recipient) => recipient.id === field.recipientId)?.email ?? '',
  // }));

  // const everySignerHasSignature = document?.Recipient.every(
  //   (recipient) =>
  //     recipient.role !== RecipientRole.SIGNER ||
  //     fieldsWithSignerEmail.some(
  //       (field) => field.type === 'SIGNATURE' && field.signerEmail === recipient.email,
  //     ),
  // );

  // if (!everySignerHasSignature) {
  //   throw new Error('Some signers have not been assigned a signature field.');
  // }

  const allRecipientsHaveNoActionToTake = envelope.recipients.every(
    (recipient) =>
      recipient.role === RecipientRole.CC || recipient.signingStatus === SigningStatus.SIGNED,
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

  // Auto insert radio and checkboxes that have default values.
  if (envelope.internalVersion === 2) {
    for (const field of envelope.fields) {
      if (field.type === FieldType.RADIO) {
        const { values = [] } = ZRadioFieldMeta.parse(field.fieldMeta);

        const checkedItemIndex = values.findIndex((value) => value.checked);

        if (checkedItemIndex !== -1) {
          fieldsToAutoInsert.push({
            fieldId: field.id,
            customText: toRadioCustomText(checkedItemIndex),
          });
        }
      }

      if (field.type === FieldType.DROPDOWN) {
        const { defaultValue } = ZDropdownFieldMeta.parse(field.fieldMeta);

        if (defaultValue) {
          fieldsToAutoInsert.push({
            fieldId: field.id,
            customText: defaultValue,
          });
        }
      }

      if (field.type === FieldType.CHECKBOX) {
        const {
          values = [],
          validationRule,
          validationLength,
        } = ZCheckboxFieldMeta.parse(field.fieldMeta);

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

          isValid = validateCheckboxLength(
            checkedIndices.length,
            validation.value,
            validationLength,
          );
        }

        if (isValid) {
          fieldsToAutoInsert.push({
            fieldId: field.id,
            customText: toCheckboxCustomText(checkedIndices),
          });
        }
      }
    }
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

    // Todo: Envelopes - [AUDIT_LOGS]
    await Promise.all(
      fieldsToAutoInsert.map(async (field) => {
        await tx.field.update({
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

  const isRecipientSigningRequestEmailEnabled = extractDerivedDocumentEmailSettings(
    envelope.documentMeta,
  ).recipientSigningRequest;

  // Only send email if one of the following is true:
  // - It is explicitly set
  // - The email is enabled for signing requests AND sendEmail is undefined
  if (sendEmail || (isRecipientSigningRequestEmailEnabled && sendEmail === undefined)) {
    await Promise.all(
      recipientsToNotify.map(async (recipient) => {
        if (recipient.sendStatus === SendStatus.SENT || recipient.role === RecipientRole.CC) {
          return;
        }

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
  }

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_SENT,
    data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(updatedEnvelope)),
    userId,
    teamId,
  });

  return updatedEnvelope;
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

  const newDocumentData = await putPdfFileServerSide({
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
