import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import type { DocumentDistributionMethod } from '@documenso/prisma/client';
import {
  DocumentSigningOrder,
  DocumentSource,
  type Field,
  type Recipient,
  RecipientRole,
  SendStatus,
  SigningStatus,
  WebhookTriggerEvents,
} from '@documenso/prisma/client';

import type { SupportedLanguageCodes } from '../../constants/i18n';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { ZRecipientAuthOptionsSchema } from '../../types/document-auth';
import type { TDocumentEmailSettings } from '../../types/document-email';
import type { TFieldMetaSchema } from '../../types/field-meta';
import { ZFieldMetaSchema } from '../../types/field-meta';
import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import type { ApiRequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import {
  createDocumentAuthOptions,
  createRecipientAuthOptions,
  extractDocumentAuthMethods,
} from '../../utils/document-auth';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

type FinalRecipient = Pick<
  Recipient,
  'name' | 'email' | 'role' | 'authOptions' | 'signingOrder'
> & {
  templateRecipientId: number;
  fields: Field[];
};

export type CreateDocumentFromTemplateOptions = {
  templateId: number;
  externalId?: string | null;
  userId: number;
  teamId?: number;
  recipients: {
    id: number;
    name?: string;
    email: string;
    signingOrder?: number | null;
  }[];
  prefillFields?: {
    id: number;
    fieldMeta: TFieldMetaSchema;
  }[];
  customDocumentDataId?: string;

  /**
   * Values that will override the predefined values in the template.
   */
  override?: {
    title?: string;
    subject?: string;
    message?: string;
    timezone?: string;
    password?: string;
    dateFormat?: string;
    redirectUrl?: string;
    signingOrder?: DocumentSigningOrder;
    language?: SupportedLanguageCodes;
    distributionMethod?: DocumentDistributionMethod;
    typedSignatureEnabled?: boolean;
    emailSettings?: TDocumentEmailSettings;
  };
  requestMetadata: ApiRequestMetadata;
};

export const createDocumentFromTemplate = async ({
  templateId,
  externalId,
  userId,
  teamId,
  recipients,
  customDocumentDataId,
  override,
  requestMetadata,
  prefillFields,
}: CreateDocumentFromTemplateOptions) => {
  const template = await prisma.template.findUnique({
    where: {
      id: templateId,
      ...(teamId
        ? {
            team: {
              id: teamId,
              members: {
                some: {
                  userId,
                },
              },
            },
          }
        : {
            userId,
            teamId: null,
          }),
    },
    include: {
      recipients: {
        include: {
          fields: true,
        },
      },
      templateDocumentData: true,
      templateMeta: true,
      team: {
        include: {
          teamGlobalSettings: true,
        },
      },
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  // Check that all the passed in recipient IDs can be associated with a template recipient.
  recipients.forEach((recipient) => {
    const foundRecipient = template.recipients.find(
      (templateRecipient) => templateRecipient.id === recipient.id,
    );

    if (!foundRecipient) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Recipient with ID ${recipient.id} not found in the template.`,
      });
    }
  });

  const { documentAuthOption: templateAuthOptions } = extractDocumentAuthMethods({
    documentAuth: template.authOptions,
  });

  const finalRecipients: FinalRecipient[] = template.recipients.map((templateRecipient) => {
    const foundRecipient = recipients.find((recipient) => recipient.id === templateRecipient.id);

    return {
      templateRecipientId: templateRecipient.id,
      fields: templateRecipient.fields,
      name: foundRecipient ? (foundRecipient.name ?? '') : templateRecipient.name,
      email: foundRecipient ? foundRecipient.email : templateRecipient.email,
      role: templateRecipient.role,
      signingOrder: foundRecipient?.signingOrder ?? templateRecipient.signingOrder,
      authOptions: templateRecipient.authOptions,
    };
  });

  let parentDocumentData = template.templateDocumentData;

  if (customDocumentDataId) {
    const customDocumentData = await prisma.documentData.findFirst({
      where: {
        id: customDocumentDataId,
      },
    });

    if (!customDocumentData) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Custom document data not found',
      });
    }

    parentDocumentData = customDocumentData;
  }

  const documentData = await prisma.documentData.create({
    data: {
      type: parentDocumentData.type,
      data: parentDocumentData.data,
      initialData: parentDocumentData.initialData,
    },
  });

  return await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        source: DocumentSource.TEMPLATE,
        externalId: externalId || template.externalId,
        templateId: template.id,
        userId,
        teamId: template.teamId,
        title: override?.title || template.title,
        documentDataId: documentData.id,
        authOptions: createDocumentAuthOptions({
          globalAccessAuth: templateAuthOptions.globalAccessAuth,
          globalActionAuth: templateAuthOptions.globalActionAuth,
        }),
        visibility: template.visibility || template.team?.teamGlobalSettings?.documentVisibility,
        documentMeta: {
          create: {
            subject: override?.subject || template.templateMeta?.subject,
            message: override?.message || template.templateMeta?.message,
            timezone: override?.timezone || template.templateMeta?.timezone,
            password: override?.password || template.templateMeta?.password,
            dateFormat: override?.dateFormat || template.templateMeta?.dateFormat,
            redirectUrl: override?.redirectUrl || template.templateMeta?.redirectUrl,
            distributionMethod:
              override?.distributionMethod || template.templateMeta?.distributionMethod,
            // last `undefined` is due to JsonValue's
            emailSettings:
              override?.emailSettings || template.templateMeta?.emailSettings || undefined,
            signingOrder:
              override?.signingOrder ||
              template.templateMeta?.signingOrder ||
              DocumentSigningOrder.PARALLEL,
            language:
              override?.language ||
              template.templateMeta?.language ||
              template.team?.teamGlobalSettings?.documentLanguage,
            typedSignatureEnabled:
              override?.typedSignatureEnabled ?? template.templateMeta?.typedSignatureEnabled,
          },
        },
        recipients: {
          createMany: {
            data: finalRecipients.map((recipient) => {
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
      },
      include: {
        recipients: {
          orderBy: {
            id: 'asc',
          },
        },
        documentData: true,
      },
    });

    let fieldsToCreate: Omit<Field, 'id' | 'secondaryId' | 'templateId'>[] = [];

    // Get all template field IDs first so we can validate later
    const allTemplateFieldIds = finalRecipients.flatMap((recipient) =>
      recipient.fields.map((field) => field.id),
    );

    if (prefillFields?.length) {
      const invalidFieldIds = prefillFields
        .map((prefillField) => prefillField.id)
        .filter((id) => !allTemplateFieldIds.includes(id));

      if (invalidFieldIds.length > 0) {
        throw new Error(
          `The following field IDs do not exist in the template: ${invalidFieldIds.join(', ')}`,
        );
      }
    }

    Object.values(finalRecipients).forEach(({ email, fields }) => {
      const recipient = document.recipients.find((recipient) => recipient.email === email);

      if (!recipient) {
        throw new Error('Recipient not found.');
      }

      fieldsToCreate = fieldsToCreate.concat(
        fields.map((field) => {
          const prefillField = prefillFields?.find((value) => value?.id === field.id);

          if (prefillField?.fieldMeta) {
            const fieldMeta = ZFieldMetaSchema.safeParse(prefillField.fieldMeta);

            if (!fieldMeta.success) {
              throw new Error(
                `There has been an error parsing field meta for field ${field.id}: ${fieldMeta.error}`,
              );
            }
          }

          return {
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
            fieldMeta: prefillField?.fieldMeta ?? field.fieldMeta,
          };
        }),
      );
    });

    await tx.field.createMany({
      data: fieldsToCreate.map((field) => ({
        ...field,
        fieldMeta: field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : undefined,
      })),
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED,
        documentId: document.id,
        metadata: requestMetadata,
        data: {
          title: document.title,
          source: {
            type: DocumentSource.TEMPLATE,
            templateId: template.id,
          },
        },
      }),
    });

    const createdDocument = await tx.document.findFirst({
      where: {
        id: document.id,
      },
      include: {
        documentMeta: true,
        recipients: true,
      },
    });

    if (!createdDocument) {
      throw new Error('Document not found');
    }

    await triggerWebhook({
      event: WebhookTriggerEvents.DOCUMENT_CREATED,
      data: ZWebhookDocumentSchema.parse(mapDocumentToWebhookDocumentPayload(createdDocument)),
      userId,
      teamId,
    });

    return document;
  });
};
