import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { generateExternal2FACode } from '@documenso/lib/server-only/2fa/external-2fa-code';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { DocumentAuth } from '@documenso/lib/types/document-auth';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';
import { EnvelopeType } from '@prisma/client';

import { authenticatedProcedure } from '../../trpc';
import {
  createEnvelopeRecipient2FACodeMeta,
  ZCreateEnvelopeRecipient2FACodeRequestSchema,
  ZCreateEnvelopeRecipient2FACodeResponseSchema,
} from './create-envelope-recipient-2fa-code.types';

export const createEnvelopeRecipient2FACodeRoute = authenticatedProcedure
  .meta(createEnvelopeRecipient2FACodeMeta)
  .input(ZCreateEnvelopeRecipient2FACodeRequestSchema)
  .output(ZCreateEnvelopeRecipient2FACodeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { envelopeId, recipientId } = input;

    ctx.logger.info({
      input: {
        envelopeId,
        recipientId,
      },
    });

    const { envelopeWhereInput } = await getEnvelopeWhereInput({
      id: { type: 'envelopeId', id: envelopeId },
      type: EnvelopeType.DOCUMENT,
      userId: user.id,
      teamId,
    });

    const recipient = await prisma.recipient.findFirst({
      where: {
        id: recipientId,
        envelope: envelopeWhereInput,
      },
      include: {
        envelope: true,
      },
    });

    if (!recipient) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Recipient not found',
      });
    }

    const { derivedRecipientAccessAuth } = extractDocumentAuthMethods({
      documentAuth: recipient.envelope.authOptions,
      recipientAuth: recipient.authOptions,
    });

    if (!derivedRecipientAccessAuth.includes(DocumentAuth.EXTERNAL_TWO_FACTOR_AUTH)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Recipient does not require external 2FA',
      });
    }

    const result = await generateExternal2FACode({ envelopeId: recipient.envelopeId, recipientId: recipient.id });

    await prisma.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_ACCESS_AUTH_2FA_REQUESTED,
        envelopeId: recipient.envelopeId,
        metadata: ctx.metadata,
        data: {
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          recipientId: recipient.id,
        },
      }),
    });

    return result;
  });
