import {
  type DocumentDataType,
  DocumentStatus,
  type EnvelopeType,
  RecipientRole,
  SigningStatus,
  type TemplateType,
} from '@prisma/client';
import { EnvelopeType as EnvelopeTypeEnum, TemplateType as TemplateTypeEnum } from '@prisma/client';
import contentDisposition from 'content-disposition';
import { type Context } from 'hono';
import { match } from 'ts-pattern';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { generatePartialSignedPdf } from '@documenso/lib/server-only/pdf/generate-partial-signed-pdf';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { sha256 } from '@documenso/lib/universal/crypto';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { prisma } from '@documenso/prisma';

import type { HonoEnv } from '../../router';

type HandleEnvelopeItemFileRequestOptions = {
  title: string;
  status: DocumentStatus;
  documentData: {
    type: DocumentDataType;
    data: string;
    initialData: string;
  };
  version: 'signed' | 'original';
  isDownload: boolean;
  context: Context<HonoEnv>;
};

type HandlePartialEnvelopeItemFileRequestOptions = {
  title: string;
  envelopeItemId: string;
  envelope: {
    id: string;
    status: DocumentStatus;
    internalVersion: number;
    recipients: Array<{
      role: RecipientRole;
      signingStatus: SigningStatus;
    }>;
  };
  documentData: {
    type: DocumentDataType;
    initialData: string;
  };
  context: Context<HonoEnv>;
};

/**
 * Helper function to handle envelope item file requests (both view and download)
 */
export const handleEnvelopeItemFileRequest = async ({
  title,
  status,
  documentData,
  version,
  isDownload,
  context: c,
}: HandleEnvelopeItemFileRequestOptions) => {
  const documentDataToUse = version === 'signed' ? documentData.data : documentData.initialData;

  const etag = Buffer.from(sha256(documentDataToUse)).toString('hex');

  if (c.req.header('If-None-Match') === etag && !isDownload) {
    return c.body(null, 304);
  }

  const file = await getFileServerSide({
    type: documentData.type,
    data: documentDataToUse,
  }).catch((error) => {
    console.error(error);

    return null;
  });

  if (!file) {
    return c.json({ error: 'File not found' }, 404);
  }

  c.header('Content-Type', 'application/pdf');
  c.header('ETag', etag);

  if (!isDownload) {
    if (status === DocumentStatus.COMPLETED) {
      c.header('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      c.header('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  }

  if (isDownload) {
    // Generate filename following the pattern from envelope-download-dialog.tsx
    const baseTitle = title.replace(/\.pdf$/, '');
    const suffix = version === 'signed' ? '_signed.pdf' : '.pdf';
    const filename = `${baseTitle}${suffix}`;

    c.header('Content-Disposition', contentDisposition(filename));

    // For downloads, prevent caching to ensure fresh data
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
  }

  return c.body(file);
};

export const handlePartialEnvelopeItemFileRequest = async ({
  title,
  envelopeItemId,
  envelope,
  documentData,
  context: c,
}: HandlePartialEnvelopeItemFileRequestOptions) => {
  if (envelope.status !== DocumentStatus.PENDING) {
    const errorCode = match(envelope.status)
      .with(DocumentStatus.DRAFT, () => AppErrorCode.ENVELOPE_DRAFT)
      .with(DocumentStatus.COMPLETED, () => AppErrorCode.ENVELOPE_COMPLETED)
      .with(DocumentStatus.REJECTED, () => AppErrorCode.ENVELOPE_REJECTED)
      .otherwise(() => AppErrorCode.INVALID_REQUEST);

    throw new AppError(errorCode, {
      message: `Envelope ${envelope.id} must be pending to download a draft signed PDF`,
      statusCode: 400,
    });
  }

  if (envelope.internalVersion !== 2) {
    throw new AppError(AppErrorCode.NOT_IMPLEMENTED, {
      message: `Envelope ${envelope.id} does not support draft signed PDF downloads`,
      statusCode: 501,
    });
  }

  const fields = await prisma.field.findMany({
    where: {
      envelopeItemId,
      inserted: true,
    },
    include: {
      signature: true,
    },
    orderBy: {
      id: 'asc',
    },
  });

  const pendingRecipientCount = envelope.recipients.filter(
    (recipient) =>
      recipient.signingStatus !== SigningStatus.SIGNED &&
      recipient.role !== RecipientRole.ASSISTANT &&
      recipient.role !== RecipientRole.CC,
  ).length;

  const etag = Buffer.from(
    sha256(
      JSON.stringify({
        envelopeStatus: envelope.status,
        pendingRecipientCount,
        fields: fields.map((field) => ({
          id: field.id,
          customText: field.customText,
          signatureId: field.signature?.id ?? null,
          signatureCreated: field.signature?.created ?? null,
        })),
      }),
    ),
  ).toString('hex');

  if (c.req.header('If-None-Match') === etag) {
    c.header('ETag', etag);
    c.header('Cache-Control', 'no-store, private');

    return c.body(null, 304);
  }

  const file = await getFileServerSide({
    type: documentData.type,
    data: documentData.initialData,
  }).catch((error) => {
    console.error(error);

    return null;
  });

  if (!file) {
    return c.json({ error: 'File not found' }, 404);
  }

  const pdf = await generatePartialSignedPdf({
    pdfData: file,
    fields,
    envelopeId: envelope.id,
    pendingRecipientCount,
    generatedAt: new Date(),
  });

  c.get('logger').info({
    source: 'partialSignedPdfDownload',
    envelopeId: envelope.id,
    envelopeItemId,
    insertedFieldCount: fields.length,
    pendingRecipientCount,
    etag,
  });

  c.header('Content-Type', 'application/pdf');
  c.header('Cache-Control', 'no-store, private');
  c.header('ETag', etag);

  const baseTitle = title.replace(/\.pdf$/i, '');
  const filename = `${baseTitle}-draft.pdf`;

  c.header('Content-Disposition', contentDisposition(filename));

  return c.body(pdf);
};

type CheckEnvelopeFileAccessOptions = {
  userId: number;
  teamId: number;
  envelopeType: EnvelopeType;
  templateType: TemplateType;
};

/**
 * Check whether a user has access to an envelope's file.
 *
 * First checks team membership. If that fails and the envelope is an
 * ORGANISATION template (not a document), falls back to checking whether
 * the user belongs to any team in the same organisation.
 */
export const checkEnvelopeFileAccess = async ({
  userId,
  teamId,
  envelopeType,
  templateType,
}: CheckEnvelopeFileAccessOptions): Promise<boolean> => {
  const team = await getTeamById({ userId, teamId }).catch(() => null);

  if (team) {
    return true;
  }

  if (
    envelopeType === EnvelopeTypeEnum.TEMPLATE &&
    templateType === TemplateTypeEnum.ORGANISATION
  ) {
    const orgAccess = await prisma.team.findFirst({
      where: {
        id: teamId,
        organisation: {
          teams: {
            some: {
              teamGroups: {
                some: {
                  organisationGroup: {
                    organisationGroupMembers: {
                      some: {
                        organisationMember: { userId },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      select: { id: true },
    });

    return orgAccess !== null;
  }

  return false;
};
