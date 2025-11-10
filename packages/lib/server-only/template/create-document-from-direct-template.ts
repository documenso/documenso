import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import type { Field, Signature } from '@prisma/client';
import {
  DocumentSigningOrder,
  DocumentSource,
  DocumentStatus,
  EnvelopeType,
  FieldType,
  Prisma,
  RecipientRole,
  SendStatus,
  SigningStatus,
  WebhookTriggerEvents,
} from '@prisma/client';
import { DateTime } from 'luxon';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { mailer } from '@documenso/email/mailer';
import { DocumentCreatedFromDirectTemplateEmailTemplate } from '@documenso/email/templates/document-created-from-direct-template';
import { nanoid, prefixedId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import type { TSignFieldWithTokenMutationSchema } from '@documenso/trpc/server/field-router/schema';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE, RECIPIENT_DIFF_TYPE } from '../../types/document-audit-logs';
import type { TRecipientActionAuthTypes } from '../../types/document-auth';
import { DocumentAccessAuth, ZRecipientAuthOptionsSchema } from '../../types/document-auth';
import { ZFieldMetaSchema } from '../../types/field-meta';
import {
  ZWebhookDocumentSchema,
  mapEnvelopeToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putPdfFileServerSide } from '../../universal/upload/put-file.server';
import { isRequiredField } from '../../utils/advanced-fields-helpers';
import { extractDerivedDocumentMeta } from '../../utils/document';
import type { CreateDocumentAuditLogDataResponse } from '../../utils/document-audit-logs';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import {
  createDocumentAuthOptions,
  createRecipientAuthOptions,
  extractDocumentAuthMethods,
} from '../../utils/document-auth';
import { mapSecondaryIdToTemplateId } from '../../utils/envelope';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { formatDocumentsPath } from '../../utils/teams';
import { sendDocument } from '../document/send-document';
import { validateFieldAuth } from '../document/validate-field-auth';
import { getEmailContext } from '../email/get-email-context';
import { incrementDocumentId } from '../envelope/increment-id';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type CreateDocumentFromDirectTemplateOptions = {
  directRecipientName?: string;
  directRecipientEmail: string;
  directTemplateToken: string;
  directTemplateExternalId?: string;
  signedFieldValues: TSignFieldWithTokenMutationSchema[];
  templateUpdatedAt: Date;
  requestMetadata: ApiRequestMetadata;
  user?: {
    id: number;
    name?: string;
    email: string;
  };
  nextSigner?: {
    email: string;
    name: string;
  };
};

type CreatedDirectRecipientField = {
  field: Field & { signature?: Signature | null };
  derivedRecipientActionAuth?: TRecipientActionAuthTypes;
};

export const ZCreateDocumentFromDirectTemplateResponseSchema = z.object({
  token: z.string(),
  envelopeId: z.string(),
  documentId: z.number(),
  recipientId: z.number(),
});

export type TCreateDocumentFromDirectTemplateResponse = z.infer<
  typeof ZCreateDocumentFromDirectTemplateResponseSchema
>;

export const createDocumentFromDirectTemplate = async ({
  directRecipientName: initialDirectRecipientName,
  directRecipientEmail,
  directTemplateToken,
  directTemplateExternalId,
  signedFieldValues,
  templateUpdatedAt,
  nextSigner,
  requestMetadata,
  user,
}: CreateDocumentFromDirectTemplateOptions): Promise<TCreateDocumentFromDirectTemplateResponse> => {
  const directTemplateEnvelope = await prisma.envelope.findFirst({
    where: {
      directLink: {
        token: directTemplateToken,
      },
    },
    include: {
      recipients: {
        include: {
          fields: true,
        },
      },
      directLink: true,
      envelopeItems: {
        include: {
          documentData: true,
        },
      },
      documentMeta: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!directTemplateEnvelope?.directLink?.enabled) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, { message: 'Invalid or missing template' });
  }

  if (
    nextSigner &&
    (!directTemplateEnvelope.documentMeta?.allowDictateNextSigner ||
      directTemplateEnvelope.documentMeta?.signingOrder !== DocumentSigningOrder.SEQUENTIAL)
  ) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message:
        'You need to enable allowDictateNextSigner and sequential signing to dictate the next signer',
    });
  }

  const directTemplateEnvelopeLegacyId = mapSecondaryIdToTemplateId(
    directTemplateEnvelope.secondaryId,
  );

  if (directTemplateEnvelope.envelopeItems.length < 1) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid number of envelope items',
    });
  }

  const { branding, settings, senderEmail, emailLanguage } = await getEmailContext({
    emailType: 'INTERNAL',
    source: {
      type: 'team',
      teamId: directTemplateEnvelope.teamId,
    },
  });

  const { recipients, directLink, user: templateOwner } = directTemplateEnvelope;

  const directTemplateRecipient = recipients.find(
    (recipient) => recipient.id === directLink.directTemplateRecipientId,
  );

  if (!directTemplateRecipient || directTemplateRecipient.role === RecipientRole.CC) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid or missing direct recipient',
    });
  }

  if (directTemplateEnvelope.updatedAt.getTime() !== templateUpdatedAt.getTime()) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, { message: 'Template no longer matches' });
  }

  const { derivedRecipientAccessAuth, documentAuthOption: templateAuthOptions } =
    extractDocumentAuthMethods({
      documentAuth: directTemplateEnvelope.authOptions,
    });

  const directRecipientName = user?.name || initialDirectRecipientName;

  // Ensure typesafety when we add more options.
  const isAccessAuthValid = match(derivedRecipientAccessAuth.at(0))
    .with(DocumentAccessAuth.ACCOUNT, () => user && user?.email === directRecipientEmail)
    .with(DocumentAccessAuth.TWO_FACTOR_AUTH, () => false) // Not supported for direct templates
    .with(undefined, () => true)
    .exhaustive();

  if (!isAccessAuthValid) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, { message: 'You must be logged in' });
  }

  const directTemplateRecipientAuthOptions = ZRecipientAuthOptionsSchema.parse(
    directTemplateRecipient.authOptions,
  );

  const nonDirectTemplateRecipients = directTemplateEnvelope.recipients.filter(
    (recipient) => recipient.id !== directTemplateRecipient.id,
  );
  const derivedDocumentMeta = extractDerivedDocumentMeta(
    settings,
    directTemplateEnvelope.documentMeta,
  );

  // Associate, validate and map to a query every direct template recipient field with the provided fields.
  // Only process fields that are either required or have been signed by the user
  const fieldsToProcess = directTemplateRecipient.fields.filter((templateField) => {
    const signedFieldValue = signedFieldValues.find((value) => value.fieldId === templateField.id);

    // Custom logic for V2 to include all fields, since v1 excludes read only
    // and prefilled fields.
    if (directTemplateEnvelope.internalVersion === 2) {
      return true;
    }

    // Include if it's required or has a signed value
    return isRequiredField(templateField) || signedFieldValue !== undefined;
  });

  const createDirectRecipientFieldArgs = await Promise.all(
    fieldsToProcess.map(async (templateField) => {
      const signedFieldValue = signedFieldValues.find(
        (value) => value.fieldId === templateField.id,
      );

      if (isRequiredField(templateField) && !signedFieldValue) {
        throw new AppError(AppErrorCode.INVALID_BODY, {
          message: 'Invalid, missing or changed fields',
        });
      }

      if (templateField.type === FieldType.NAME && directRecipientName === undefined) {
        directRecipientName === signedFieldValue?.value;
      }

      const derivedRecipientActionAuth = await validateFieldAuth({
        documentAuthOptions: directTemplateEnvelope.authOptions,
        recipient: {
          authOptions: directTemplateRecipient.authOptions,
          email: directRecipientEmail,
          envelopeId: directTemplateEnvelope.id,
        },
        field: templateField,
        userId: user?.id,
        authOptions: signedFieldValue?.authOptions,
      });

      if (!signedFieldValue) {
        return {
          templateField,
          customText: '',
          derivedRecipientActionAuth,
          signature: null,
        };
      }

      const { value, isBase64 } = signedFieldValue;

      const isSignatureField =
        templateField.type === FieldType.SIGNATURE ||
        templateField.type === FieldType.FREE_SIGNATURE;

      let customText = !isSignatureField ? value : '';

      const signatureImageAsBase64 = isSignatureField && isBase64 ? value : undefined;
      const typedSignature = isSignatureField && !isBase64 ? value : undefined;

      if (templateField.type === FieldType.DATE) {
        customText = DateTime.now()
          .setZone(derivedDocumentMeta.timezone)
          .toFormat(derivedDocumentMeta.dateFormat);
      }

      if (isSignatureField && !signatureImageAsBase64 && !typedSignature) {
        throw new Error('Signature field must have a signature');
      }

      return {
        templateField,
        customText,
        derivedRecipientActionAuth,
        signature: isSignatureField
          ? {
              signatureImageAsBase64,
              typedSignature,
            }
          : null,
      };
    }),
  );

  const directTemplateNonSignatureFields = createDirectRecipientFieldArgs.filter(
    ({ signature }) => signature === null,
  );

  const directTemplateSignatureFields = createDirectRecipientFieldArgs.filter(
    ({ signature }) => signature !== null,
  );

  const initialRequestTime = new Date();

  // Key = original envelope item ID
  // Value = duplicated envelope item ID.
  const oldEnvelopeItemToNewEnvelopeItemIdMap: Record<string, string> = {};

  // Duplicate the envelope item data.
  const envelopeItemsToCreate = await Promise.all(
    directTemplateEnvelope.envelopeItems.map(async (item, i) => {
      const buffer = await getFileServerSide(item.documentData);

      const titleToUse = item.title || directTemplateEnvelope.title;

      const duplicatedFile = await putPdfFileServerSide({
        name: titleToUse,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(buffer),
      });

      const newDocumentData = await prisma.documentData.create({
        data: {
          type: duplicatedFile.type,
          data: duplicatedFile.data,
          initialData: duplicatedFile.initialData,
        },
      });

      const newEnvelopeItemId = prefixedId('envelope_item');

      oldEnvelopeItemToNewEnvelopeItemIdMap[item.id] = newEnvelopeItemId;

      return {
        id: newEnvelopeItemId,
        title: titleToUse.endsWith('.pdf') ? titleToUse.slice(0, -4) : titleToUse,
        documentDataId: newDocumentData.id,
        order: item.order !== undefined ? item.order : i + 1,
      };
    }),
  );

  const documentMeta = await prisma.documentMeta.create({
    data: derivedDocumentMeta,
  });

  const incrementedDocumentId = await incrementDocumentId();

  const { createdEnvelope, recipientId, token } = await prisma.$transaction(async (tx) => {
    // Create the envelope and non direct template recipients.
    const createdEnvelope = await tx.envelope.create({
      data: {
        id: prefixedId('envelope'),
        secondaryId: incrementedDocumentId.formattedDocumentId,
        type: EnvelopeType.DOCUMENT,
        internalVersion: directTemplateEnvelope.internalVersion,
        qrToken: prefixedId('qr'),
        source: DocumentSource.TEMPLATE_DIRECT_LINK,
        templateId: directTemplateEnvelopeLegacyId,
        userId: directTemplateEnvelope.userId,
        teamId: directTemplateEnvelope.teamId,
        title: directTemplateEnvelope.title,
        createdAt: initialRequestTime,
        status: DocumentStatus.PENDING,
        externalId: directTemplateExternalId,
        visibility: settings.documentVisibility,
        envelopeItems: {
          createMany: {
            data: envelopeItemsToCreate,
          },
        },
        authOptions: createDocumentAuthOptions({
          globalAccessAuth: templateAuthOptions.globalAccessAuth,
          globalActionAuth: templateAuthOptions.globalActionAuth,
        }),
        recipients: {
          createMany: {
            data: nonDirectTemplateRecipients.map((recipient) => {
              const authOptions = ZRecipientAuthOptionsSchema.parse(recipient?.authOptions);

              return {
                email: recipient.email,
                name: recipient.name,
                role: recipient.role,
                authOptions: createRecipientAuthOptions({
                  accessAuth: authOptions.accessAuth,
                  actionAuth: authOptions.actionAuth,
                }),
                sendStatus:
                  recipient.role === RecipientRole.CC ? SendStatus.SENT : SendStatus.NOT_SENT,
                signingStatus:
                  recipient.role === RecipientRole.CC
                    ? SigningStatus.SIGNED
                    : SigningStatus.NOT_SIGNED,
                signingOrder: recipient.signingOrder,
                token: nanoid(),
              };
            }),
          },
        },
        documentMetaId: documentMeta.id,
      },
      include: {
        recipients: true,
        team: {
          select: {
            url: true,
          },
        },
        envelopeItems: {
          select: {
            id: true,
          },
        },
      },
    });

    let nonDirectRecipientFieldsToCreate: Omit<Field, 'id' | 'secondaryId' | 'templateId'>[] = [];

    Object.values(nonDirectTemplateRecipients).forEach((templateRecipient) => {
      const recipient = createdEnvelope.recipients.find(
        (recipient) => recipient.email === templateRecipient.email,
      );

      if (!recipient) {
        throw new Error('Recipient not found.');
      }

      nonDirectRecipientFieldsToCreate = nonDirectRecipientFieldsToCreate.concat(
        templateRecipient.fields.map((field) => ({
          envelopeId: createdEnvelope.id,
          envelopeItemId: oldEnvelopeItemToNewEnvelopeItemIdMap[field.envelopeItemId],
          recipientId: recipient.id,
          type: field.type,
          page: field.page,
          positionX: field.positionX,
          positionY: field.positionY,
          width: field.width,
          height: field.height,
          customText: '',
          inserted: false,
          fieldMeta: field.fieldMeta,
        })),
      );
    });

    await tx.field.createMany({
      data: nonDirectRecipientFieldsToCreate.map((field) => ({
        ...field,
        fieldMeta: field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : undefined,
      })),
    });

    // Create the direct recipient and their non signature fields.
    const createdDirectRecipient = await tx.recipient.create({
      data: {
        envelopeId: createdEnvelope.id,
        email: directRecipientEmail,
        name: directRecipientName,
        authOptions: createRecipientAuthOptions({
          accessAuth: directTemplateRecipientAuthOptions.accessAuth,
          actionAuth: directTemplateRecipientAuthOptions.actionAuth,
        }),
        role: directTemplateRecipient.role,
        token: nanoid(),
        signingStatus: SigningStatus.SIGNED,
        sendStatus: SendStatus.SENT,
        signedAt: initialRequestTime,
        signingOrder: directTemplateRecipient.signingOrder,
        fields: {
          createMany: {
            data: directTemplateNonSignatureFields.map(({ templateField, customText }) => {
              let inserted = true;

              // Custom logic for V2 to only insert if values exist.
              if (directTemplateEnvelope.internalVersion === 2) {
                inserted = customText !== '';
              }

              return {
                envelopeId: createdEnvelope.id,
                envelopeItemId: oldEnvelopeItemToNewEnvelopeItemIdMap[templateField.envelopeItemId],
                type: templateField.type,
                page: templateField.page,
                positionX: templateField.positionX,
                positionY: templateField.positionY,
                width: templateField.width,
                height: templateField.height,
                customText: customText ?? '',
                inserted,
                fieldMeta: templateField.fieldMeta || Prisma.JsonNull,
              };
            }),
          },
        },
      },
      include: {
        fields: true,
      },
    });

    // Create any direct recipient signature fields.
    // Note: It's done like this because we can't nest things in createMany.
    const createdDirectRecipientSignatureFields: CreatedDirectRecipientField[] = await Promise.all(
      directTemplateSignatureFields.map(
        async ({ templateField, signature, derivedRecipientActionAuth }) => {
          if (!signature) {
            throw new Error('Not possible.');
          }

          const field = await tx.field.create({
            data: {
              envelopeId: createdEnvelope.id,
              envelopeItemId: oldEnvelopeItemToNewEnvelopeItemIdMap[templateField.envelopeItemId],
              recipientId: createdDirectRecipient.id,
              type: templateField.type,
              page: templateField.page,
              positionX: templateField.positionX,
              positionY: templateField.positionY,
              width: templateField.width,
              height: templateField.height,
              customText: '',
              inserted: true,
              fieldMeta: templateField.fieldMeta || Prisma.JsonNull,
              signature: {
                create: {
                  recipientId: createdDirectRecipient.id,
                  signatureImageAsBase64: signature.signatureImageAsBase64,
                  typedSignature: signature.typedSignature,
                },
              },
            },
            include: {
              signature: true,
            },
          });

          return {
            field,
            derivedRecipientActionAuth,
          };
        },
      ),
    );

    const createdDirectRecipientFields: CreatedDirectRecipientField[] = [
      ...createdDirectRecipient.fields.map((field) => ({
        field,
        derivedRecipientActionAuth: undefined,
      })),
      ...createdDirectRecipientSignatureFields,
    ];

    /**
     * Create the following audit logs.
     * - DOCUMENT_CREATED
     * - DOCUMENT_FIELD_INSERTED
     * - DOCUMENT_RECIPIENT_COMPLETED
     */
    const auditLogsToCreate: CreateDocumentAuditLogDataResponse[] = [
      createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED,
        envelopeId: createdEnvelope.id,
        user: {
          id: user?.id,
          name: user?.name,
          email: directRecipientEmail,
        },
        metadata: requestMetadata,
        data: {
          title: createdEnvelope.title,
          source: {
            type: DocumentSource.TEMPLATE_DIRECT_LINK,
            templateId: directTemplateEnvelopeLegacyId,
            directRecipientEmail,
          },
        },
      }),
      createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED,
        envelopeId: createdEnvelope.id,
        user: {
          id: user?.id,
          name: user?.name,
          email: directRecipientEmail,
        },
        metadata: requestMetadata,
        data: {
          recipientEmail: createdDirectRecipient.email,
          recipientId: createdDirectRecipient.id,
          recipientName: createdDirectRecipient.name,
          recipientRole: createdDirectRecipient.role,
          accessAuth: derivedRecipientAccessAuth || undefined,
        },
      }),
      ...createdDirectRecipientFields.map(({ field, derivedRecipientActionAuth }) =>
        createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED,
          envelopeId: createdEnvelope.id,
          user: {
            id: user?.id,
            name: user?.name,
            email: directRecipientEmail,
          },
          metadata: requestMetadata,
          data: {
            recipientEmail: createdDirectRecipient.email,
            recipientId: createdDirectRecipient.id,
            recipientName: createdDirectRecipient.name,
            recipientRole: createdDirectRecipient.role,
            fieldId: field.secondaryId,
            field: match(field.type)
              .with(FieldType.SIGNATURE, FieldType.FREE_SIGNATURE, (type) => ({
                type,
                data:
                  field.signature?.signatureImageAsBase64 || field.signature?.typedSignature || '',
              }))
              .with(
                FieldType.DATE,
                FieldType.EMAIL,
                FieldType.INITIALS,
                FieldType.NAME,
                FieldType.TEXT,
                FieldType.NUMBER,
                FieldType.CHECKBOX,
                FieldType.DROPDOWN,
                FieldType.RADIO,
                (type) => ({
                  type,
                  data: field.customText,
                }),
              )
              .exhaustive(),
            fieldSecurity: derivedRecipientActionAuth
              ? {
                  type: derivedRecipientActionAuth,
                }
              : undefined,
          },
        }),
      ),
      createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED,
        envelopeId: createdEnvelope.id,
        user: {
          id: user?.id,
          name: user?.name,
          email: directRecipientEmail,
        },
        metadata: requestMetadata,
        data: {
          recipientEmail: createdDirectRecipient.email,
          recipientId: createdDirectRecipient.id,
          recipientName: createdDirectRecipient.name,
          recipientRole: createdDirectRecipient.role,
          actionAuth: createdDirectRecipient.authOptions?.actionAuth ?? [],
        },
      }),
    ];

    if (nextSigner) {
      const pendingRecipients = await tx.recipient.findMany({
        select: {
          id: true,
          signingOrder: true,
          name: true,
          email: true,
          role: true,
        },
        where: {
          envelopeId: createdEnvelope.id,
          signingStatus: {
            not: SigningStatus.SIGNED,
          },
          role: {
            not: RecipientRole.CC,
          },
        },
        // Composite sort so our next recipient is always the one with the lowest signing order or id
        // if there is a tie.
        orderBy: [{ signingOrder: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      });

      const nextRecipient = pendingRecipients[0];

      if (nextRecipient) {
        auditLogsToCreate.push(
          createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_UPDATED,
            envelopeId: createdEnvelope.id,
            user: {
              name: user?.name || directRecipientName || '',
              email: user?.email || directRecipientEmail,
            },
            metadata: requestMetadata,
            data: {
              recipientEmail: nextRecipient.email,
              recipientName: nextRecipient.name,
              recipientId: nextRecipient.id,
              recipientRole: nextRecipient.role,
              changes: [
                {
                  type: RECIPIENT_DIFF_TYPE.NAME,
                  from: nextRecipient.name,
                  to: nextSigner.name,
                },
                {
                  type: RECIPIENT_DIFF_TYPE.EMAIL,
                  from: nextRecipient.email,
                  to: nextSigner.email,
                },
              ],
            },
          }),
        );

        await tx.recipient.update({
          where: { id: nextRecipient.id },
          data: {
            sendStatus: SendStatus.SENT,
            ...(nextSigner && documentMeta?.allowDictateNextSigner
              ? {
                  name: nextSigner.name,
                  email: nextSigner.email,
                }
              : {}),
          },
        });
      }
    }

    await tx.documentAuditLog.createMany({
      data: auditLogsToCreate,
    });

    const templateAttachments = await tx.envelopeAttachment.findMany({
      where: {
        envelopeId: directTemplateEnvelope.id,
      },
    });

    if (templateAttachments.length > 0) {
      await tx.envelopeAttachment.createMany({
        data: templateAttachments.map((attachment) => ({
          envelopeId: createdEnvelope.id,
          type: attachment.type,
          label: attachment.label,
          data: attachment.data,
        })),
      });
    }

    // Send email to template owner.
    const emailTemplate = createElement(DocumentCreatedFromDirectTemplateEmailTemplate, {
      recipientName: directRecipientEmail,
      recipientRole: directTemplateRecipient.role,
      documentLink: `${NEXT_PUBLIC_WEBAPP_URL()}${formatDocumentsPath(createdEnvelope.team?.url)}/${
        createdEnvelope.id
      }`,
      documentName: createdEnvelope.title,
      assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000',
    });

    const [html, text] = await Promise.all([
      renderEmailWithI18N(emailTemplate, { lang: emailLanguage, branding }),
      renderEmailWithI18N(emailTemplate, { lang: emailLanguage, branding, plainText: true }),
    ]);

    const i18n = await getI18nInstance(emailLanguage);

    await mailer.sendMail({
      to: [
        {
          name: templateOwner.name || '',
          address: templateOwner.email,
        },
      ],
      from: senderEmail,
      subject: i18n._(msg`Document created from direct template`),
      html,
      text,
    });

    return {
      createdEnvelope,
      token: createdDirectRecipient.token,
      recipientId: createdDirectRecipient.id,
    };
  });

  try {
    // This handles sending emails and sealing the document if required.
    await sendDocument({
      id: {
        type: 'envelopeId',
        id: createdEnvelope.id,
      },
      userId: createdEnvelope.userId,
      teamId: createdEnvelope.teamId,
      requestMetadata,
    });

    // Refetch envelope so we get the final data.
    const refetchedEnvelope = await prisma.envelope.findFirstOrThrow({
      where: {
        id: createdEnvelope.id,
      },
      include: {
        documentMeta: true,
        recipients: true,
      },
    });

    await triggerWebhook({
      event: WebhookTriggerEvents.DOCUMENT_SIGNED,
      data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(refetchedEnvelope)),
      userId: refetchedEnvelope.userId,
      teamId: refetchedEnvelope.teamId ?? undefined,
    });
  } catch (err) {
    console.error('[CREATE_DOCUMENT_FROM_DIRECT_TEMPLATE]:', err);

    // Don't launch an error since the document has already been created.
    // Log and reseal as required until we configure middleware.
  }

  return {
    token,
    envelopeId: createdEnvelope.id,
    documentId: incrementedDocumentId.documentId,
    recipientId,
  };
};
