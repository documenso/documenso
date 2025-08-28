import { EnvelopeType } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { parseDocumentIdToEnvelopeSecondaryId } from '@documenso/lib/utils/envelope';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { procedure } from '../trpc';
import {
  ZGetDocumentInternalUrlForQRCodeInput,
  ZGetDocumentInternalUrlForQRCodeOutput,
} from './get-document-internal-url-for-qr-code.types';

export const getDocumentInternalUrlForQRCodeRoute = procedure
  .input(ZGetDocumentInternalUrlForQRCodeInput)
  .output(ZGetDocumentInternalUrlForQRCodeOutput)
  .query(async ({ input, ctx }) => {
    const { documentId } = input;

    ctx.logger.info({
      input: {
        documentId,
      },
    });

    if (!ctx.user) {
      return null;
    }

    const envelope = await prisma.envelope.findFirst({
      where: {
        type: EnvelopeType.DOCUMENT,
        OR: [
          {
            secondaryId: parseDocumentIdToEnvelopeSecondaryId(documentId),
            userId: ctx.user.id,
          },
          {
            secondaryId: parseDocumentIdToEnvelopeSecondaryId(documentId),
            team: buildTeamWhereQuery({ teamId: undefined, userId: ctx.user.id }),
          },
        ],
      },
      include: {
        team: true,
      },
    });

    if (!envelope) {
      return null;
    }

    return `${NEXT_PUBLIC_WEBAPP_URL()}/t/${envelope.team.url}/documents/${documentId}`;
  });
