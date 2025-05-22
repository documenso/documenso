import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import type { Field, Signature } from '@prisma/client';
import {
  DocumentSigningOrder,
  DocumentSource,
  DocumentStatus,
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
import { DEFAULT_DOCUMENT_DATE_FORMAT } from '../../constants/date-formats';
import { DEFAULT_DOCUMENT_TIME_ZONE } from '../../constants/time-zones';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { TRecipientActionAuthTypes } from '../../types/document-auth';
import { DocumentAccessAuth, ZRecipientAuthOptionsSchema } from '../../types/document-auth';
import { ZFieldMetaSchema } from '../../types/field-meta';
import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { isRequiredField } from '../../utils/advanced-fields-helpers';
import type { CreateDocumentAuditLogDataResponse } from '../../utils/document-audit-logs';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import {
  createDocumentAuthOptions,
  createRecipientAuthOptions,
  extractDocumentAuthMethods,
} from '../../utils/document-auth';
import { env } from '../../utils/env';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { formatDocumentsPath } from '../../utils/teams';
import { sendDocument } from '../document/send-document';
import { validateFieldAuth } from '../document/validate-field-auth';
import { getEmailContext } from '../email/get-email-context';
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
};

type CreatedDirectRecipientField = {
  field: Field & { signature?: Signature | null };
  derivedRecipientActionAuth: TRecipientActionAuthTypes | null;
};

export const ZCreateDocumentFromDirectTemplateResponseSchema = z.object({
  token: z.string(),
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
  requestMetadata,
  user,
}: CreateDocumentFromDirectTemplateOptions): Promise<TCreateDocumentFromDirectTemplateResponse> => {
  const template = await prisma.template.findFirst({
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
      templateDocumentData: true,
      templateMeta: true,
      user: true,
    },
  });

  if (!template?.directLink?.enabled) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, { message: 'Invalid or missing template' });
  }

  const { branding, settings } = await getEmailContext({
    source: {
      type: 'team',
      teamId: template.teamId,
    },
  });

  const { recipients, directLink, user: templateOwner } = template;

  const directTemplateRecipient = recipients.find(
    (recipient) => recipient.id === directLink.directTemplateRecipientId,
  );

  if (!directTemplateRecipient || directTemplateRecipient.role === RecipientRole.CC) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid or missing direct recipient',
    });
  }

  if (template.updatedAt.getTime() !== templateUpdatedAt.getTime()) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, { message: 'Template no longer matches' });
  }

  if (user && user.email !== directRecipientEmail) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Email must match if you are logged in',
    });
  }

  const { derivedRecipientAccessAuth, documentAuthOption: templateAuthOptions } =
    extractDocumentAuthMethods({
      documentAuth: template.authOptions,
    });

  const directRecipientName = user?.name || initialDirectRecipientName;

  // Ensure typesafety when we add more options.
  const isAccessAuthValid = match(derivedRecipientAccessAuth)
    .with(DocumentAccessAuth.ACCOUNT, () => user && user?.email === directRecipientEmail)
    .with(null, () => true)
    .exhaustive();

  if (!isAccessAuthValid) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, { message: 'You must be logged in' });
  }

  const directTemplateRecipientAuthOptions = ZRecipientAuthOptionsSchema.parse(
    directTemplateRecipient.authOptions,
  );

  const nonDirectTemplateRecipients = template.recipients.filter(
    (recipient) => recipient.id !== directTemplateRecipient.id,
  );

  const metaTimezone = template.templateMeta?.timezone || DEFAULT_DOCUMENT_TIME_ZONE;
  const metaDateFormat = template.templateMeta?.dateFormat || DEFAULT_DOCUMENT_DATE_FORMAT;
  const metaEmailMessage = template.templateMeta?.message || '';
  const metaEmailSubject = template.templateMeta?.subject || '';
  const metaLanguage = template.templateMeta?.language ?? settings.documentLanguage;
  const metaSigningOrder = template.templateMeta?.signingOrder || DocumentSigningOrder.PARALLEL;

  // Associate, validate and map to a query every direct template recipient field with the provided fields.
  // Only process fields that are either required or have been signed by the user
  const fieldsToProcess = directTemplateRecipient.fields.filter((templateField) => {
    const signedFieldValue = signedFieldValues.find((value) => value.fieldId === templateField.id);

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
        documentAuthOptions: template.authOptions,
        recipient: {
          authOptions: directTemplateRecipient.authOptions,
          email: directRecipientEmail,
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
        customText = DateTime.now().setZone(metaTimezone).toFormat(metaDateFormat);
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

  const { documentId, recipientId, token } = await prisma.$transaction(async (tx) => {
    const documentData = await tx.documentData.create({
      data: {
        type: template.templateDocumentData.type,
        data: template.templateDocumentData.data,
        initialData: template.templateDocumentData.initialData,
      },
    });

    // Create the document and non direct template recipients.
    const document = await tx.document.create({
      data: {
        qrToken: prefixedId('qr'),
        source: DocumentSource.TEMPLATE_DIRECT_LINK,
        templateId: template.id,
        userId: template.userId,
        teamId: template.teamId,
        title: template.title,
        createdAt: initialRequestTime,
        status: DocumentStatus.PENDING,
        externalId: directTemplateExternalId,
        visibility: settings.documentVisibility,
        documentDataId: documentData.id,
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
        documentMeta: {
          create: {
            timezone: metaTimezone,
            dateFormat: metaDateFormat,
            message: metaEmailMessage,
            subject: metaEmailSubject,
            language: metaLanguage,
            signingOrder: metaSigningOrder,
            distributionMethod: template.templateMeta?.distributionMethod,
            typedSignatureEnabled: template.templateMeta?.typedSignatureEnabled,
            uploadSignatureEnabled: template.templateMeta?.uploadSignatureEnabled,
            drawSignatureEnabled: template.templateMeta?.drawSignatureEnabled,
          },
        },
      },
      include: {
        recipients: true,
        team: {
          select: {
            url: true,
          },
        },
      },
    });

    let nonDirectRecipientFieldsToCreate: Omit<Field, 'id' | 'secondaryId' | 'templateId'>[] = [];

    Object.values(nonDirectTemplateRecipients).forEach((templateRecipient) => {
      const recipient = document.recipients.find(
        (recipient) => recipient.email === templateRecipient.email,
      );

      if (!recipient) {
        throw new Error('Recipient not found.');
      }

      nonDirectRecipientFieldsToCreate = nonDirectRecipientFieldsToCreate.concat(
        templateRecipient.fields.map((field) => ({
          documentId: document.id,
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
        documentId: document.id,
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
            data: directTemplateNonSignatureFields.map(({ templateField, customText }) => ({
              documentId: document.id,
              type: templateField.type,
              page: templateField.page,
              positionX: templateField.positionX,
              positionY: templateField.positionY,
              width: templateField.width,
              height: templateField.height,
              customText: customText ?? '',
              inserted: true,
              fieldMeta: templateField.fieldMeta || Prisma.JsonNull,
            })),
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
              documentId: document.id,
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
        derivedRecipientActionAuth: null,
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
        documentId: document.id,
        user: {
          id: user?.id,
          name: user?.name,
          email: directRecipientEmail,
        },
        metadata: requestMetadata,
        data: {
          title: document.title,
          source: {
            type: DocumentSource.TEMPLATE_DIRECT_LINK,
            templateId: template.id,
            directRecipientEmail,
          },
        },
      }),
      createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED,
        documentId: document.id,
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
          documentId: document.id,
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
        documentId: document.id,
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
        },
      }),
    ];

    await tx.documentAuditLog.createMany({
      data: auditLogsToCreate,
    });

    // Send email to template owner.
    const emailTemplate = createElement(DocumentCreatedFromDirectTemplateEmailTemplate, {
      recipientName: directRecipientEmail,
      recipientRole: directTemplateRecipient.role,
      documentLink: `${NEXT_PUBLIC_WEBAPP_URL()}${formatDocumentsPath(document.team?.url)}/${
        document.id
      }`,
      documentName: document.title,
      assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000',
    });

    const [html, text] = await Promise.all([
      renderEmailWithI18N(emailTemplate, { lang: metaLanguage, branding }),
      renderEmailWithI18N(emailTemplate, { lang: metaLanguage, branding, plainText: true }),
    ]);

    const i18n = await getI18nInstance(metaLanguage);

    await mailer.sendMail({
      to: [
        {
          name: templateOwner.name || '',
          address: templateOwner.email,
        },
      ],
      from: {
        name: env('NEXT_PRIVATE_SMTP_FROM_NAME') || 'Documenso',
        address: env('NEXT_PRIVATE_SMTP_FROM_ADDRESS') || 'noreply@documenso.com',
      },
      subject: i18n._(msg`Document created from direct template`),
      html,
      text,
    });

    return {
      token: createdDirectRecipient.token,
      documentId: document.id,
      recipientId: createdDirectRecipient.id,
    };
  });

  try {
    // This handles sending emails and sealing the document if required.
    await sendDocument({
      documentId,
      userId: template.userId,
      teamId: template.teamId,
      requestMetadata,
    });

    const createdDocument = await prisma.document.findFirstOrThrow({
      where: {
        id: documentId,
      },
      include: {
        documentData: true,
        documentMeta: true,
        recipients: true,
      },
    });

    await triggerWebhook({
      event: WebhookTriggerEvents.DOCUMENT_SIGNED,
      data: ZWebhookDocumentSchema.parse(mapDocumentToWebhookDocumentPayload(createdDocument)),
      userId: template.userId,
      teamId: template.teamId ?? undefined,
    });
  } catch (err) {
    console.error('[CREATE_DOCUMENT_FROM_DIRECT_TEMPLATE]:', err);

    // Don't launch an error since the document has already been created.
    // Log and reseal as required until we configure middleware.
  }

  return {
    token,
    documentId,
    recipientId,
  };
};
