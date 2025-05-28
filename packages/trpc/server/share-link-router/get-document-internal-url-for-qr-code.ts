import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
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

    if (!ctx.user) {
      return null;
    }

    const document = await prisma.document.findFirst({
      where: {
        OR: [
          {
            id: documentId,
            userId: ctx.user.id,
          },
          {
            id: documentId,
            team: {
              members: {
                some: {
                  userId: ctx.user.id,
                },
              },
            },
          },
        ],
      },
      include: {
        team: {
          where: {
            members: {
              some: {
                userId: ctx.user.id,
              },
            },
          },
        },
      },
    });

    if (!document) {
      return null;
    }

    if (document.team) {
      return `${NEXT_PUBLIC_WEBAPP_URL()}/t/${document.team.url}/documents/${document.id}`;
    }

    return `${NEXT_PUBLIC_WEBAPP_URL()}/documents/${document.id}`;
  });
