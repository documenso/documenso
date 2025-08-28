import { DocumentSource, EnvelopeType, WebhookTriggerEvents } from '@prisma/client';
import type { DocumentVisibility } from '@prisma/client';

import { normalizePdf as makeNormalizedPdf } from '@documenso/lib/server-only/pdf/normalize-pdf';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import {
  ZWebhookDocumentSchema,
  mapEnvelopeToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import { prefixedId } from '../../universal/id';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putPdfFileServerSide } from '../../universal/upload/put-file.server';
import { extractDerivedDocumentMeta } from '../../utils/document';
import { determineDocumentVisibility } from '../../utils/document-visibility';
import { buildDocumentId } from '../../utils/envelope';
import { buildTeamWhereQuery } from '../../utils/teams';
import { getTeamById } from '../team/get-team';
import { getTeamSettings } from '../team/get-team-settings';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type CreateDocumentOptions = {
  title: string;
  externalId?: string | null;
  userId: number;
  teamId: number;
  documentDataId: string;
  formValues?: Record<string, string | number | boolean>;
  normalizePdf?: boolean;
  timezone?: string;
  userTimezone?: string;
  requestMetadata: ApiRequestMetadata;
  folderId?: string;
};

export const createDocument = async ({
  userId,
  title,
  externalId,
  documentDataId,
  teamId,
  normalizePdf,
  formValues,
  requestMetadata,
  timezone,
  userTimezone,
  folderId,
}: CreateDocumentOptions) => {
  const team = await getTeamById({ userId, teamId });

  const settings = await getTeamSettings({
    userId,
    teamId,
  });

  let folderVisibility: DocumentVisibility | undefined;

  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        team: buildTeamWhereQuery({
          teamId,
          userId,
        }),
      },
      select: {
        visibility: true,
      },
    });

    if (!folder) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Folder not found',
      });
    }

    folderVisibility = folder.visibility;
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

  // userTimezone is last because it's always passed in regardless of the organisation/team settings
  // for uploads from the frontend
  const timezoneToUse = timezone || settings.documentTimezone || userTimezone;

  return await prisma.$transaction(async (tx) => {
    const documentIdCounter = await tx.counter.update({
      where: {
        id: 'document',
      },
      data: {
        value: {
          increment: 1,
        },
      },
    });

    const documentId = buildDocumentId(documentIdCounter.value);

    const documentMeta = await tx.documentMeta.create({
      data: extractDerivedDocumentMeta(settings, {
        timezone: timezoneToUse,
      }),
    });

    const envelope = await tx.envelope.create({
      data: {
        title,
        type: EnvelopeType.DOCUMENT,
        secondaryId: documentId,
        qrToken: prefixedId('qr'),
        externalId,
        documents: {
          create: {
            title,
            documentDataId,
          },
        },
        userId,
        teamId,
        folderId,
        visibility:
          folderVisibility ??
          determineDocumentVisibility(settings.documentVisibility, team.currentTeamRole),
        formValues,
        source: DocumentSource.DOCUMENT,
        documentMetaId: documentMeta.id,
      },
      include: {
        documentMeta: true,
        recipients: true,
      },
    });

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
      data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(envelope)),
      userId,
      teamId,
    });

    return {
      id: documentIdCounter.value,
      envelope,
    };
  });
};
