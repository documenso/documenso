import type { DocumentMeta, DocumentVisibility, TemplateType } from '@prisma/client';
import {
  DocumentSource,
  EnvelopeType,
  FolderType,
  RecipientRole,
  SendStatus,
  SigningStatus,
  WebhookTriggerEvents,
} from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { normalizePdf as makeNormalizedPdf } from '@documenso/lib/server-only/pdf/normalize-pdf';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { nanoid, prefixedId } from '@documenso/lib/universal/id';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import type { TCreateDocumentTemporaryRequest } from '@documenso/trpc/server/document-router/create-document-temporary.types';

import type { TDocumentAccessAuthTypes, TDocumentActionAuthTypes } from '../../types/document-auth';
import type { TDocumentFormValues } from '../../types/document-form-values';
import {
  ZWebhookDocumentSchema,
  mapEnvelopeToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putPdfFileServerSide } from '../../universal/upload/put-file.server';
import { extractDerivedDocumentMeta } from '../../utils/document';
import { createDocumentAuthOptions, createRecipientAuthOptions } from '../../utils/document-auth';
import { buildTeamWhereQuery } from '../../utils/teams';
import { incrementDocumentId, incrementTemplateId } from '../envelope/increment-id';
import { getTeamSettings } from '../team/get-team-settings';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type CreateEnvelopeOptions = {
  userId: number;
  teamId: number;
  normalizePdf?: boolean;
  data: {
    type: EnvelopeType;
    title: string;
    externalId?: string;
    envelopeItems: { title?: string; documentDataId: string }[];
    formValues?: TDocumentFormValues;

    timezone?: string;
    userTimezone?: string;

    templateType?: TemplateType;
    publicTitle?: string;
    publicDescription?: string;

    visibility?: DocumentVisibility;
    globalAccessAuth?: TDocumentAccessAuthTypes[];
    globalActionAuth?: TDocumentActionAuthTypes[];
    recipients?: TCreateDocumentTemporaryRequest['recipients'];
    folderId?: string;
  };
  meta?: Partial<Omit<DocumentMeta, 'id'>>;
  requestMetadata: ApiRequestMetadata;
};

export const createEnvelope = async ({
  userId,
  teamId,
  normalizePdf,
  data,
  meta,
  requestMetadata,
}: CreateEnvelopeOptions) => {
  const {
    type,
    title,
    externalId,
    formValues,
    timezone,
    userTimezone,
    folderId,
    templateType,
    globalAccessAuth,
    globalActionAuth,
    publicTitle,
    publicDescription,
    visibility: visibilityOverride,
  } = data;

  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery({ teamId, userId }),
    include: {
      organisation: {
        select: {
          organisationClaim: true,
        },
      },
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  // Verify that the folder exists and is associated with the team.
  if (folderId) {
    const folder = await prisma.folder.findUnique({
      where: {
        id: folderId,
        type: data.type === EnvelopeType.TEMPLATE ? FolderType.TEMPLATE : FolderType.DOCUMENT,
        team: buildTeamWhereQuery({ teamId, userId }),
      },
    });

    if (!folder) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Folder not found',
      });
    }
  }

  const settings = await getTeamSettings({
    userId,
    teamId,
  });

  let envelopeItems: { title?: string; documentDataId: string }[] = data.envelopeItems;

  if (normalizePdf) {
    envelopeItems = await Promise.all(
      data.envelopeItems.map(async (item) => {
        const documentData = await prisma.documentData.findFirst({
          where: {
            id: item.documentDataId,
          },
        });

        if (!documentData) {
          throw new AppError(AppErrorCode.NOT_FOUND, {
            message: 'Document data not found',
          });
        }

        const buffer = await getFileServerSide(documentData);

        const normalizedPdf = await makeNormalizedPdf(Buffer.from(buffer));

        const newDocumentData = await putPdfFileServerSide({
          name: title.endsWith('.pdf') ? title : `${title}.pdf`,
          type: 'application/pdf',
          arrayBuffer: async () => Promise.resolve(normalizedPdf),
        });

        return {
          title: item.title,
          documentDataId: newDocumentData.id,
        };
      }),
    );
  }

  const authOptions = createDocumentAuthOptions({
    globalAccessAuth: globalAccessAuth || [],
    globalActionAuth: globalActionAuth || [],
  });

  const recipientsHaveActionAuth = data.recipients?.some(
    (recipient) => recipient.actionAuth && recipient.actionAuth.length > 0,
  );

  // Check if user has permission to set the global action auth.
  if (
    (authOptions.globalActionAuth.length > 0 || recipientsHaveActionAuth) &&
    !team.organisation.organisationClaim.flags.cfr21
  ) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to set the action auth',
    });
  }

  const visibility = visibilityOverride || settings.documentVisibility;

  const emailId = meta?.emailId;

  // Validate that the email ID belongs to the organisation.
  if (emailId) {
    const email = await prisma.organisationEmail.findFirst({
      where: {
        id: emailId,
        organisationId: team.organisationId,
      },
    });

    if (!email) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Email not found',
      });
    }
  }

  // userTimezone is last because it's always passed in regardless of the organisation/team settings
  // for uploads from the frontend
  const timezoneToUse = timezone || settings.documentTimezone || userTimezone;

  const documentMeta = await prisma.documentMeta.create({
    data: extractDerivedDocumentMeta(settings, {
      ...meta,
      timezone: timezoneToUse,
    }),
  });

  const secondaryId =
    type === EnvelopeType.DOCUMENT
      ? await incrementDocumentId().then((v) => v.formattedDocumentId)
      : await incrementTemplateId().then((v) => v.formattedTemplateId);

  return await prisma.$transaction(async (tx) => {
    const envelope = await tx.envelope.create({
      data: {
        id: prefixedId('envelope'),
        secondaryId,
        type,
        title,
        qrToken: prefixedId('qr'),
        externalId,
        envelopeItems: {
          createMany: {
            data: envelopeItems.map((item) => ({
              id: prefixedId('envelope_item'),
              title: item.title || title,
              documentDataId: item.documentDataId,
            })),
          },
        },
        userId,
        teamId,
        authOptions,
        visibility,
        folderId,
        formValues,
        source: DocumentSource.DOCUMENT, // Todo: Migration
        documentMetaId: documentMeta.id,

        // Template specific fields.
        templateType: type === EnvelopeType.TEMPLATE ? templateType : undefined,
        publicTitle: type === EnvelopeType.TEMPLATE ? publicTitle : undefined,
        publicDescription: type === EnvelopeType.TEMPLATE ? publicDescription : undefined,
      },
      include: {
        envelopeItems: true,
      },
    });

    // Todo: Envelopes - Support multiple envelope items.
    const firstEnvelopeItemId = envelope.envelopeItems[0].id;

    await Promise.all(
      (data.recipients || []).map(async (recipient) => {
        const recipientAuthOptions = createRecipientAuthOptions({
          accessAuth: recipient.accessAuth ?? [],
          actionAuth: recipient.actionAuth ?? [],
        });

        await tx.recipient.create({
          data: {
            envelopeId: envelope.id,
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
                  envelopeId: envelope.id,
                  envelopeItemId: firstEnvelopeItemId,
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

    const createdEnvelope = await tx.envelope.findFirst({
      where: {
        id: envelope.id,
      },
      include: {
        documentMeta: true,
        recipients: true,
        fields: true,
        folder: true,
        envelopeItems: true,
      },
    });

    if (!createdEnvelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    // Only create audit logs and webhook events for documents.
    if (type === EnvelopeType.DOCUMENT) {
      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED,
          envelopeId: envelope.id,
          metadata: requestMetadata,
          data: {
            title,
            source: {
              type: DocumentSource.DOCUMENT,
            },
          },
        }),
      });

      await triggerWebhook({
        event: WebhookTriggerEvents.DOCUMENT_CREATED,
        data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(createdEnvelope)),
        userId,
        teamId,
      });
    }

    return createdEnvelope;
  });
};
