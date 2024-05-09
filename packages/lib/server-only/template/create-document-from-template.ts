import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import type { Field } from '@documenso/prisma/client';
import { type Recipient, WebhookTriggerEvents } from '@documenso/prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { ZRecipientAuthOptionsSchema } from '../../types/document-auth';
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
  userId: number;
  teamId?: number;
  recipients: {
    id: number;
    name?: string;
    email: string;
  }[];
  requestMetadata?: RequestMetadata;
};

export const createDocumentFromTemplate = async ({
  templateId,
  userId,
  teamId,
  recipients,
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

  if (recipients.length !== template.Recipient.length) {
    throw new AppError(AppErrorCode.INVALID_BODY, 'Invalid number of recipients.');
  }

  const { documentAuthOption: templateAuthOptions } = extractDocumentAuthMethods({
    documentAuth: template.authOptions,
  });

  const finalRecipients: FinalRecipient[] = template.Recipient.map((templateRecipient) => {
    const foundRecipient = recipients.find((recipient) => recipient.id === templateRecipient.id);

    if (!foundRecipient) {
      throw new AppError(
        AppErrorCode.INVALID_BODY,
        `Missing template recipient with ID ${templateRecipient.id}`,
      );
    }

    return {
      templateRecipientId: templateRecipient.id,
      fields: templateRecipient.Field,
      name: foundRecipient.name ?? '',
      email: foundRecipient.email,
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
        userId,
        teamId: template.teamId,
        title: template.title,
        documentDataId: documentData.id,
        authOptions: createDocumentAuthOptions({
          globalAccessAuth: templateAuthOptions.globalAccessAuth,
          globalActionAuth: templateAuthOptions.globalActionAuth,
        }),
        documentMeta: {
          create: {
            subject: template.templateMeta?.subject,
            message: template.templateMeta?.message,
            timezone: template.templateMeta?.timezone,
            password: template.templateMeta?.password,
            dateFormat: template.templateMeta?.dateFormat,
            redirectUrl: template.templateMeta?.redirectUrl,
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
        })),
      );
    });

    await tx.field.createMany({
      data: fieldsToCreate,
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED,
        documentId: document.id,
        user,
        requestMetadata,
        data: {
          title: document.title,
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
