import {
  type DocumentDataType,
  DocumentStatus,
  type EnvelopeType,
  type TemplateType,
} from '@prisma/client';
import { EnvelopeType as EnvelopeTypeEnum, TemplateType as TemplateTypeEnum } from '@prisma/client';
import contentDisposition from 'content-disposition';
import { type Context } from 'hono';

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
