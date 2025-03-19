import type { DocumentVisibility, TemplateMeta } from '@prisma/client';
import {
  DocumentSource,
  RecipientRole,
  SendStatus,
  SigningStatus,
  WebhookTriggerEvents,
} from '@prisma/client';
import { TeamMemberRole } from '@prisma/client';

import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { normalizePdf as makeNormalizedPdf } from '@documenso/lib/server-only/pdf/normalize-pdf';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { nanoid } from '@documenso/lib/universal/id';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import type { TCreateDocumentV2Request } from '@documenso/trpc/server/document-router/schema';

import type { TDocumentAccessAuthTypes, TDocumentActionAuthTypes } from '../../types/document-auth';
import type { TDocumentFormValues } from '../../types/document-form-values';
import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putPdfFileServerSide } from '../../universal/upload/put-file.server';
import { createDocumentAuthOptions, createRecipientAuthOptions } from '../../utils/document-auth';
import { determineDocumentVisibility } from '../../utils/document-visibility';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type CreateDocumentOptions = {
  userId: number;
  teamId?: number;
  documentDataId: string;
  normalizePdf?: boolean;
  data: {
    title: string;
    externalId?: string;
    visibility?: DocumentVisibility;
    globalAccessAuth?: TDocumentAccessAuthTypes;
    globalActionAuth?: TDocumentActionAuthTypes;
    formValues?: TDocumentFormValues;
    recipients: TCreateDocumentV2Request['recipients'];
  };
  meta?: Partial<Omit<TemplateMeta, 'id' | 'templateId'>>;
  requestMetadata: ApiRequestMetadata;
};

export const createDocumentV2 = async ({
  userId,
  teamId,
  documentDataId,
  normalizePdf,
  data,
  meta,
  requestMetadata,
}: CreateDocumentOptions) => {
  const { title, formValues } = data;

  const team = teamId
    ? await prisma.team.findFirst({
        where: {
          id: teamId,
          members: {
            some: {
              userId,
            },
          },
        },
        include: {
          teamGlobalSettings: true,
          members: {
            where: {
              userId: userId,
            },
            select: {
              role: true,
            },
          },
        },
      })
    : null;

  if (teamId !== undefined && !team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  if (normalizePdf) {
    const documentData = await prisma.documentData.findFirst({
      where: {
        id: documentDataId,
      },
    });

    if (documentData) {
      const buffer = await getFileServerSide(documentData);

      const normalizedPdf = await makeNormalizedPdf(Buffer.from(buffer));

      const newDocumentData = await putPdfFileServerSide({
        name: title.endsWith('.pdf') ? title : `${title}.pdf`,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(normalizedPdf),
      });

      // eslint-disable-next-line require-atomic-updates
      documentDataId = newDocumentData.id;
    }
  }

  const authOptions = createDocumentAuthOptions({
    globalAccessAuth: data?.globalAccessAuth || null,
    globalActionAuth: data?.globalActionAuth || null,
  });

  const recipientsHaveActionAuth = data.recipients?.some((recipient) => recipient.actionAuth);

  // Check if user has permission to set the global action auth.
  if (authOptions.globalActionAuth || recipientsHaveActionAuth) {
    const isDocumentEnterprise = await isUserEnterprise({
      userId,
      teamId,
    });

    if (!isDocumentEnterprise) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have permission to set the action auth',
      });
    }
  }

  const visibility = determineDocumentVisibility(
    team?.teamGlobalSettings?.documentVisibility,
    team?.members[0].role ?? TeamMemberRole.MEMBER,
  );

  return await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        title,
        externalId: data.externalId,
        documentDataId,
        userId,
        teamId,
        authOptions,
        visibility,
        formValues,
        source: DocumentSource.DOCUMENT,
        documentMeta: {
          create: {
            ...meta,
            signingOrder: meta?.signingOrder || undefined,
            emailSettings: meta?.emailSettings || undefined,
            language: meta?.language || team?.teamGlobalSettings?.documentLanguage,
            typedSignatureEnabled:
              meta?.typedSignatureEnabled ?? team?.teamGlobalSettings?.typedSignatureEnabled,
            uploadSignatureEnabled:
              meta?.uploadSignatureEnabled ?? team?.teamGlobalSettings?.uploadSignatureEnabled,
            drawSignatureEnabled:
              meta?.drawSignatureEnabled ?? team?.teamGlobalSettings?.drawSignatureEnabled,
          },
        },
      },
    });

    await Promise.all(
      (data.recipients || []).map(async (recipient) => {
        const recipientAuthOptions = createRecipientAuthOptions({
          accessAuth: recipient.accessAuth || null,
          actionAuth: recipient.actionAuth || null,
        });

        await tx.recipient.create({
          data: {
            documentId: document.id,
            name: recipient.name,
            email: recipient.email,
            role: recipient.role,
            signingOrder: recipient.signingOrder,
            token: nanoid(),
            sendStatus: recipient.role === RecipientRole.CC ? SendStatus.SENT : SendStatus.NOT_SENT,
            signingStatus:
              recipient.role === RecipientRole.CC ? SigningStatus.SIGNED : SigningStatus.NOT_SIGNED,
            authOptions: recipientAuthOptions,
            fields: {
              createMany: {
                data: (recipient.fields || []).map((field) => ({
                  documentId: document.id,
                  type: field.type,
                  page: field.pageNumber,
                  positionX: field.pageX,
                  positionY: field.pageY,
                  width: field.width,
                  height: field.height,
                  customText: '',
                  inserted: false,
                  fieldMeta: field.fieldMeta,
                })),
              },
            },
          },
        });
      }),
    );

    // Todo: Is it necessary to create a full audit log with all fields and recipients audit logs?

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED,
        documentId: document.id,
        metadata: requestMetadata,
        data: {
          title,
          source: {
            type: DocumentSource.DOCUMENT,
          },
        },
      }),
    });

    const createdDocument = await tx.document.findFirst({
      where: {
        id: document.id,
      },
      include: {
        documentData: true,
        documentMeta: true,
        recipients: true,
        fields: true,
      },
    });

    if (!createdDocument) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Document not found',
      });
    }

    await triggerWebhook({
      event: WebhookTriggerEvents.DOCUMENT_CREATED,
      data: ZWebhookDocumentSchema.parse(mapDocumentToWebhookDocumentPayload(createdDocument)),
      userId,
      teamId,
    });

    return createdDocument;
  });
};
