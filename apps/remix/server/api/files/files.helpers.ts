import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { generatePartialSignedPdf } from '@documenso/lib/server-only/pdf/generate-partial-signed-pdf';
import { getTeamById } from '@documenso/lib/server-only/team/get-team';
import { sha256 } from '@documenso/lib/universal/crypto';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { prisma } from '@documenso/prisma';
import {
  type DocumentDataType,
  DocumentStatus,
  type EnvelopeType,
  EnvelopeType as EnvelopeTypeEnum,
  type RecipientRole,
  type SigningStatus,
  type TemplateType,
  TemplateType as TemplateTypeEnum,
} from '@prisma/client';
import contentDisposition from 'content-disposition';
import type { Context } from 'hono';
import { match } from 'ts-pattern';

import type { HonoEnv } from '../../router';

type DocumentDataInput = {
  type: DocumentDataType;
  data: string;
  initialData: string;
};

type EnvelopeForPendingDownload = {
  id: string;
  status: DocumentStatus;
  internalVersion: number;
  recipients: Array<{
    role: RecipientRole;
    signingStatus: SigningStatus;
  }>;
};

/**
 * Options shape varies by `version`:
 * - `signed` / `original`: serves stored bytes; only needs envelope `status` for cache headers.
 * - `pending`: generates a fresh PDF with currently-inserted fields burned in; needs the
 *   full envelope (id, status, internalVersion, recipients) plus envelopeItemId to query fields.
 */
type HandleEnvelopeItemFileRequestOptions = {
  title: string;
  documentData: DocumentDataInput;
  isDownload: boolean;
  context: Context<HonoEnv>;
} & (
  | {
      version: 'signed' | 'original';
      status: DocumentStatus;
    }
  | {
      version: 'pending';
      envelopeItemId: string;
      envelope: EnvelopeForPendingDownload;
    }
);

/**
 * Single entry point for envelope item file requests (view and download).
 *
 * Dispatches on `version`:
 * - `signed` / `original`: returns the stored PDF bytes as-is.
 * - `pending`: generates an on-demand PDF with all currently-inserted fields burned in.
 */
export const handleEnvelopeItemFileRequest = async (options: HandleEnvelopeItemFileRequestOptions) => {
  if (options.version === 'pending') {
    return handlePendingFileRequest(options);
  }

  return handleStaticFileRequest(options);
};

type StaticFileRequestOptions = Extract<HandleEnvelopeItemFileRequestOptions, { version: 'signed' | 'original' }>;

const handleStaticFileRequest = async ({
  title,
  status,
  documentData,
  version,
  isDownload,
  context: c,
}: StaticFileRequestOptions) => {
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

type PendingFileRequestOptions = Extract<HandleEnvelopeItemFileRequestOptions, { version: 'pending' }>;

const handlePendingFileRequest = async ({
  title,
  envelopeItemId,
  envelope,
  documentData,
  context: c,
}: PendingFileRequestOptions) => {
  if (envelope.status !== DocumentStatus.PENDING) {
    const errorCode = match(envelope.status)
      .with(DocumentStatus.DRAFT, () => AppErrorCode.ENVELOPE_DRAFT)
      .with(DocumentStatus.COMPLETED, () => AppErrorCode.ENVELOPE_COMPLETED)
      .with(DocumentStatus.REJECTED, () => AppErrorCode.ENVELOPE_REJECTED)
      .otherwise(() => AppErrorCode.INVALID_REQUEST);

    throw new AppError(errorCode, {
      message: `Envelope ${envelope.id} must be pending to download a partially signed PDF`,
      statusCode: 400,
    });
  }

  if (envelope.internalVersion !== 2) {
    throw new AppError(AppErrorCode.ENVELOPE_LEGACY, {
      message: `Envelope ${envelope.id} is a legacy envelope and does not support partially signed PDF downloads`,
      statusCode: 400,
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

  const etag = Buffer.from(
    sha256(
      JSON.stringify({
        envelopeStatus: envelope.status,
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
  });

  c.get('logger').info({
    source: 'pendingPdfDownload',
    envelopeId: envelope.id,
    envelopeItemId,
    insertedFieldCount: fields.length,
    etag,
  });

  c.header('Content-Type', 'application/pdf');
  c.header('Cache-Control', 'no-store, private');
  c.header('ETag', etag);

  const baseTitle = title.replace(/\.pdf$/i, '');
  const filename = `${baseTitle}_pending.pdf`;

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

  if (envelopeType === EnvelopeTypeEnum.TEMPLATE && templateType === TemplateTypeEnum.ORGANISATION) {
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
