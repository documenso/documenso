import { resolveExpiresAt } from '@documenso/lib/constants/envelope-expiration';
import { AppError } from '@documenso/lib/errors/app-error';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, EnvelopeType, RecipientRole, SigningStatus, WebhookTriggerEvents } from '@prisma/client';

import { jobs } from '../../jobs/client';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import { mapEnvelopeToWebhookDocumentPayload, ZWebhookDocumentSchema } from '../../types/webhook-payload';
import { isDocumentCompleted } from '../../utils/document';
import { type EnvelopeIdOptions, mapSecondaryIdToDocumentId } from '../../utils/envelope';
import { isRecipientEmailValidForSending } from '../../utils/recipients';
import { getEmailContext } from '../email/get-email-context';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { assertOrganisationRatesAndLimits } from '../rate-limit/assert-organisation-rates-and-limits';
import { assertUserNotDisabled } from '../user/assert-user-not-disabled';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type ResendDocumentOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  recipients: number[];
  teamId: number;
  requestMetadata: ApiRequestMetadata;
};

export const resendDocument = async ({ id, userId, recipients, teamId, requestMetadata }: ResendDocumentOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      disabled: true,
    },
  });

  // Refuse to resend on behalf of a disabled account. Guards
  // document.redistribute / envelope.redistribute and the API v1 equivalent.
  assertUserNotDisabled(user);

  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findUnique({
    where: envelopeWhereInput,
    include: {
      recipients: true,
      documentMeta: true,
      team: {
        select: {
          teamEmail: true,
          name: true,
          organisation: {
            select: {
              organisationClaim: {
                select: {
                  recipientCount: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!envelope) {
    throw new Error('Document not found');
  }

  if (envelope.recipients.length === 0) {
    throw new Error('Document has no recipients');
  }

  if (envelope.status === DocumentStatus.DRAFT) {
    throw new Error('Can not send draft document');
  }

  if (isDocumentCompleted(envelope.status)) {
    throw new Error('Can not send completed document');
  }

  // A recipientCount of 0 means unlimited recipients are allowed. Block resending
  // when the document has more recipients than the organisation is allowed to send
  // to, mirroring the check in `sendDocument`. This prevents bypassing the limit by
  // adding recipients to an already-sent document and then resending.
  const maximumRecipientCount = envelope.team.organisation.organisationClaim.recipientCount;

  if (maximumRecipientCount > 0 && envelope.recipients.length > maximumRecipientCount) {
    throw new AppError('RECIPIENT_LIMIT_EXCEEDED', {
      message: `You cannot send a document with more than ${maximumRecipientCount} recipients`,
      statusCode: 400,
    });
  }

  // Refresh the expiresAt on each resent recipient.
  const expiresAt = resolveExpiresAt(envelope.documentMeta?.envelopeExpirationPeriod ?? null);

  const recipientsToRemind = envelope.recipients.filter(
    (recipient) =>
      recipients.includes(recipient.id) &&
      recipient.signingStatus === SigningStatus.NOT_SIGNED &&
      recipient.role !== RecipientRole.CC,
  );

  // Extend the expiration deadline for recipients being resent.
  if (expiresAt && recipientsToRemind.length > 0) {
    await prisma.recipient.updateMany({
      where: {
        id: {
          in: recipientsToRemind.map((r) => r.id),
        },
      },
      data: {
        expiresAt,
        expirationNotifiedAt: null,
      },
    });
  }

  const isRecipientSigningRequestEmailEnabled = extractDerivedDocumentEmailSettings(
    envelope.documentMeta,
  ).recipientSigningRequest;

  if (!isRecipientSigningRequestEmailEnabled) {
    return envelope;
  }

  const { organisationId, claims, emailsDisabled } = await getEmailContext({
    emailType: 'RECIPIENT',
    source: {
      type: 'team',
      teamId: envelope.teamId,
    },
    meta: envelope.documentMeta,
  });

  const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

  // Don't resend any emails if the organisation has email sending disabled.
  if (user.disabled || emailsDisabled) {
    return envelope;
  }

  // Assert that there is enough quota to send the emails.
  await assertOrganisationRatesAndLimits({
    organisationId,
    organisationClaim: claims,
    count: recipientsToRemind.length,
    type: 'email',
  });

  await Promise.all(
    recipientsToRemind.map(async (recipient) => {
      if (recipient.role === RecipientRole.CC || !isRecipientEmailValidForSending(recipient)) {
        return;
      }

      await jobs.triggerJob({
        name: 'send.document.reminder.email',
        payload: {
          userId,
          documentId: legacyDocumentId,
          recipientId: recipient.id,
          requestMetadata: requestMetadata?.requestMetadata,
          auditUser: requestMetadata?.auditUser,
        },
      });
    }),
  );

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_REMINDER_SENT,
    data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(envelope)),
    userId: envelope.userId,
    teamId: envelope.teamId,
  });

  return envelope;
};
