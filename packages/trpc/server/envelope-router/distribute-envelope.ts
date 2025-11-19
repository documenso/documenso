import { updateDocumentMeta } from '@documenso/lib/server-only/document-meta/upsert-document-meta';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { formatSigningLink } from '@documenso/lib/utils/recipients';

import { authenticatedProcedure } from '../trpc';
import {
  ZDistributeEnvelopeRequestSchema,
  ZDistributeEnvelopeResponseSchema,
  distributeEnvelopeMeta,
} from './distribute-envelope.types';

export const distributeEnvelopeRoute = authenticatedProcedure
  .meta(distributeEnvelopeMeta)
  .input(ZDistributeEnvelopeRequestSchema)
  .output(ZDistributeEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { envelopeId, meta = {} } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    if (Object.values(meta).length > 0) {
      await updateDocumentMeta({
        userId: ctx.user.id,
        teamId,
        id: {
          type: 'envelopeId',
          id: envelopeId,
        },
        subject: meta.subject,
        message: meta.message,
        dateFormat: meta.dateFormat,
        timezone: meta.timezone,
        redirectUrl: meta.redirectUrl,
        distributionMethod: meta.distributionMethod,
        emailSettings: meta.emailSettings ?? undefined,
        language: meta.language,
        emailId: meta.emailId,
        emailReplyTo: meta.emailReplyTo,
        requestMetadata: ctx.metadata,
      });
    }

    const envelope = await sendDocument({
      userId: ctx.user.id,
      id: {
        type: 'envelopeId',
        id: envelopeId,
      },
      teamId,
      requestMetadata: ctx.metadata,
    });

    return {
      success: true,
      id: envelope.id,
      recipients: envelope.recipients.map((recipient) => ({
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        token: recipient.token,
        role: recipient.role,
        signingOrder: recipient.signingOrder,
        signingUrl: formatSigningLink(recipient.token),
      })),
    };
  });
