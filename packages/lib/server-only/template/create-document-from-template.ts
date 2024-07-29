import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import type { Field } from '@documenso/prisma/client';
import {
  DocumentSource,
  type Recipient,
  RecipientRole,
  SendStatus,
  SigningStatus,
  WebhookTriggerEvents,
} from '@documenso/prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { ZRecipientAuthOptionsSchema } from '../../types/document-auth';
import { ZFieldMetaSchema } from '../../types/field-meta';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import {
  createDocumentAuthOptions,
  createRecipientAuthOptions,
  extractDocumentAuthMethods,
} from '../../utils/document-auth';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

type FinalRecipient = Pick<Recipient, 'name' | 'email' | 'role' | 'authOptions'> & {
  templateRecipientId: number;
  fields: Field[];
};

export type CreateDocumentFromTemplateResponse = Awaited<
  ReturnType<typeof createDocumentFromTemplate>
>;

export type CreateDocumentFromTemplateOptions = {
  templateId: number;
  externalId?: string | null;
  userId: number;
  teamId?: number;
  recipients: {
    id: number;
    name?: string;
    email: string;
  }[];

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
  };
  requestMetadata?: RequestMetadata;
};

export const createDocumentFromTemplate = async ({
  templateId,
  externalId,
  userId,
  teamId,
  recipients,
  override,
  requestMetadata,
}: CreateDocumentFromTemplateOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

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
      Recipient: {
        include: {
          Field: true,
        },
      },
      templateDocumentData: true,
      templateMeta: true,
    },
  });

  if (!template) {
    throw new AppError(AppErrorCode.NOT_FOUND, 'Template not found');
  }

  // Check that all the passed in recipient IDs can be associated with a template recipient.
  recipients.forEach((recipient) => {
    const foundRecipient = template.Recipient.find(
      (templateRecipient) => templateRecipient.id === recipient.id,
    );

    if (!foundRecipient) {
      throw new AppError(
        AppErrorCode.INVALID_BODY,
        `Recipient with ID ${recipient.id} not found in the template.`,
      );
    }
  });

  const { documentAuthOption: templateAuthOptions } = extractDocumentAuthMethods({
    documentAuth: template.authOptions,
  });

  const finalRecipients: FinalRecipient[] = template.Recipient.map((templateRecipient) => {
    const foundRecipient = recipients.find((recipient) => recipient.id === templateRecipient.id);

    return {
      templateRecipientId: templateRecipient.id,
      fields: templateRecipient.Field,
      name: foundRecipient ? foundRecipient.name ?? '' : templateRecipient.name,
      email: foundRecipient ? foundRecipient.email : templateRecipient.email,
      role: templateRecipient.role,
      authOptions: templateRecipient.authOptions,
    };
  });

  const documentData = await prisma.documentData.create({
    data: {
      type: template.templateDocumentData.type,
      data: template.templateDocumentData.data,
      initialData: template.templateDocumentData.initialData,
    },
  });

  return await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        source: DocumentSource.TEMPLATE,
        externalId,
        templateId: template.id,
        userId,
        teamId: template.teamId,
        title: override?.title || template.title,
        documentDataId: documentData.id,
        authOptions: createDocumentAuthOptions({
          globalAccessAuth: templateAuthOptions.globalAccessAuth,
          globalActionAuth: templateAuthOptions.globalActionAuth,
        }),
        documentMeta: {
          create: {
            subject: override?.subject || template.templateMeta?.subject,
            message: override?.message || template.templateMeta?.message,
            timezone: override?.timezone || template.templateMeta?.timezone,
            password: override?.password || template.templateMeta?.password,
            dateFormat: override?.dateFormat || template.templateMeta?.dateFormat,
            redirectUrl: override?.redirectUrl || template.templateMeta?.redirectUrl,
          },
        },
        Recipient: {
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
                token: nanoid(),
              };
            }),
          },
        },
      },
      include: {
        Recipient: {
          orderBy: {
            id: 'asc',
          },
        },
        documentData: true,
      },
    });

    let fieldsToCreate: Omit<Field, 'id' | 'secondaryId' | 'templateId'>[] = [];

    Object.values(finalRecipients).forEach(({ email, fields }) => {
      const recipient = document.Recipient.find((recipient) => recipient.email === email);

      if (!recipient) {
        throw new Error('Recipient not found.');
      }

      fieldsToCreate = fieldsToCreate.concat(
        fields.map((field) => ({
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
      data: fieldsToCreate.map((field) => ({
        ...field,
        fieldMeta: field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : undefined,
      })),
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED,
        documentId: document.id,
        user,
        requestMetadata,
        data: {
          title: document.title,
          source: {
            type: DocumentSource.TEMPLATE,
            templateId: template.id,
          },
        },
      }),
    });

    await triggerWebhook({
      event: WebhookTriggerEvents.DOCUMENT_CREATED,
      data: document,
      userId,
      teamId,
    });

    return document;
  });
};
