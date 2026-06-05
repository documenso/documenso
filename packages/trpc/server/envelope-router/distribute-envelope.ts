import { updateDocumentMeta } from '@documenso/lib/server-only/document-meta/upsert-document-meta';
import { scheduleDocument } from '@documenso/lib/server-only/document/schedule-document';
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
    const { envelopeId, scheduledAt, meta = {} } = input;

    ctx.logger.info({
      input: {
        envelopeId,
        scheduledAt,
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

    // When a future send time is provided, schedule the envelope instead of sending it now.
    // The scheduled-send sweep job dispatches it via `sendDocument` once the time is reached.
    const envelope = scheduledAt
      ? await scheduleDocument({
          userId: ctx.user.id,
          id: {
            type: 'envelopeId',
            id: envelopeId,
          },
          teamId,
          scheduledAt: new Date(scheduledAt),
        })
      : await sendDocument({
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
