import { EnvelopeType } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { DateTime } from 'luxon';

import { TWO_FACTOR_EMAIL_EXPIRATION_MINUTES } from '@documenso/lib/server-only/2fa/email/constants';
import { send2FATokenEmail } from '@documenso/lib/server-only/2fa/email/send-2fa-token-email';
import { DocumentAuth } from '@documenso/lib/types/document-auth';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';

import { procedure } from '../trpc';
import {
  ZAccessAuthRequest2FAEmailRequestSchema,
  ZAccessAuthRequest2FAEmailResponseSchema,
} from './access-auth-request-2fa-email.types';

export const accessAuthRequest2FAEmailRoute = procedure
  .input(ZAccessAuthRequest2FAEmailRequestSchema)
  .output(ZAccessAuthRequest2FAEmailResponseSchema)
  .mutation(async ({ input, ctx }) => {
    try {
      const { token } = input;

      const user = ctx.user;

      // Get document and recipient by token
      const envelope = await prisma.envelope.findFirst({
        where: {
          type: EnvelopeType.DOCUMENT,
          recipients: {
            some: {
              token,
            },
          },
        },
        include: {
          recipients: {
            where: {
              token,
            },
          },
        },
      });

      if (!envelope) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        });
      }

      const [recipient] = envelope.recipients;

      const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
        documentAuth: envelope.authOptions,
        recipientAuth: recipient.authOptions,
      });

      if (!derivedRecipientAccessAuth.includes(DocumentAuth.TWO_FACTOR_AUTH)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '2FA is not required for this document',
        });
      }

      // if (user && recipient.email !== user.email) {
      //   throw new TRPCError({
      //     code: 'UNAUTHORIZED',
      //     message: 'User does not match recipient',
      //   });
      // }

      const expiresAt = DateTime.now().plus({ minutes: TWO_FACTOR_EMAIL_EXPIRATION_MINUTES });

      await send2FATokenEmail({
        token,
        envelopeId: envelope.id,
      });

      return {
        success: true,
        expiresAt: expiresAt.toJSDate(),
      };
    } catch (error) {
      console.error('Error sending access auth 2FA email:', error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to send 2FA email',
      });
    }
  });
