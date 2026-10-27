import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createEmailSuppression } from '@documenso/lib/server-only/email-suppression/create-email-suppression';
import type { TEmailSuppressionTarget } from '@documenso/lib/types/email-suppression';
import { isRecipientEmailValidForSending } from '@documenso/lib/utils/recipients';
import { prisma } from '@documenso/prisma';
import { EmailSuppressionScope, EmailSuppressionSource } from '@prisma/client';
import { match } from 'ts-pattern';

import { procedure } from '../../trpc';
import {
  ZSuppressRecipientEmailsRequestSchema,
  ZSuppressRecipientEmailsResponseSchema,
} from './suppress-recipient-emails.types';

/**
 * NOTE: THIS IS A PUBLIC (UNAUTHENTICATED) PROCEDURE.
 * Recipients stop emails directly from the report link in their email, so no session or
 * API token is required. The recipient token is what proves they own the address.
 */
export const suppressRecipientEmailsRoute = procedure
  .input(ZSuppressRecipientEmailsRequestSchema)
  .output(ZSuppressRecipientEmailsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { token, scope } = input;

    const recipient = await prisma.recipient.findFirst({
      where: { token },
      select: {
        id: true,
        email: true,
        envelopeId: true,
        envelope: {
          select: {
            userId: true,
            teamId: true,
            team: {
              select: {
                organisationId: true,
              },
            },
          },
        },
      },
    });

    if (!recipient) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Recipient could not be found',
      });
    }

    if (!isRecipientEmailValidForSending(recipient)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Recipient does not have a valid email address',
      });
    }

    const { envelope } = recipient;

    const target = match<EmailSuppressionScope, TEmailSuppressionTarget>(scope)
      .with(EmailSuppressionScope.GLOBAL, (scope) => ({ scope }))
      .with(EmailSuppressionScope.ORGANISATION, (scope) => ({ scope, organisationId: envelope.team.organisationId }))
      .with(EmailSuppressionScope.TEAM, (scope) => ({ scope, teamId: envelope.teamId }))
      .with(EmailSuppressionScope.USER, (scope) => ({ scope, userId: envelope.userId }))
      .exhaustive();

    // Repeat submissions are expected (double clicks, revisiting the link), so an
    // existing suppression counts as success.
    await createEmailSuppression({
      email: recipient.email,
      target,
      source: EmailSuppressionSource.RECIPIENT,
    }).catch((error) => {
      if (AppError.parseError(error).code !== AppErrorCode.ALREADY_EXISTS) {
        throw error;
      }
    });

    ctx.logger.info({
      msg: 'Recipient suppressed emails',
      recipientId: recipient.id,
      envelopeId: recipient.envelopeId,
      scope,
    });
  });
