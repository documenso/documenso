import { DocumentInviteEmailTemplate } from '@documenso/email/templates/document-invite';
import { resolveExpiresAt } from '@documenso/lib/constants/envelope-expiration';
import { RECIPIENT_ROLE_TO_EMAIL_TYPE, RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { AppError } from '@documenso/lib/errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { renderCustomEmailTemplate } from '@documenso/lib/utils/render-custom-email-template';
import { prisma } from '@documenso/prisma';
import { msg } from '@lingui/core/macro';
import {
  DocumentStatus,
  EnvelopeType,
  OrganisationType,
  RecipientRole,
  SendStatus,
  SigningStatus,
  WebhookTriggerEvents,
} from '@prisma/client';
import { createElement } from 'react';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { extractDerivedDocumentEmailSettings } from '../../types/document-email';
import { mapEnvelopeToWebhookDocumentPayload, ZWebhookDocumentSchema } from '../../types/webhook-payload';
import { isDocumentCompleted } from '../../utils/document';
import type { EnvelopeIdOptions } from '../../utils/envelope';
import { isRecipientEmailValidForSending } from '../../utils/recipients';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { buildEnvelopeEmailHeaders } from '../email/build-envelope-email-headers';
import { getEmailContext } from '../email/get-email-context';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { assertOrganisationRatesAndLimits } from '../rate-limit/assert-organisation-rates-and-limits';
import { updateRecipientNextReminder } from '../recipient/update-recipient-next-reminder';
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

  const expiresAt = resolveExpiresAt(envelope.documentMeta?.envelopeExpirationPeriod ?? null);

  const recipientsToRemind = envelope.recipients.filter(
    (recipient) =>
      recipients.includes(recipient.id) &&
      recipient.signingStatus === SigningStatus.NOT_SIGNED &&
      recipient.role !== RecipientRole.CC,
  );

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

  // A manual resend restarts the reminder cycle from scratch, mirroring the
  // initial send, so a recipient that hit the threshold can be reminded again.
  const resentAt = new Date();

  await Promise.all(
    recipientsToRemind.map((recipient) =>
      updateRecipientNextReminder({
        recipientId: recipient.id,
        envelopeId: envelope.id,
        sentAt: resentAt,
        lastReminderSentAt: null,
        resetReminderCount: true,
      }),
    ),
  );

  const isRecipientSigningRequestEmailEnabled = extractDerivedDocumentEmailSettings(
    envelope.documentMeta,
  ).recipientSigningRequest;

  if (!isRecipientSigningRequestEmailEnabled) {
    return envelope;
  }

  const {
    branding,
    emailLanguage,
    organisationType,
    senderEmail,
    replyToEmail,
    organisationId,
    claims,
    emailsDisabled,
    emailTransport,
  } = await getEmailContext({
    emailType: 'RECIPIENT',
    source: {
      type: 'team',
      teamId: envelope.teamId,
    },
    meta: envelope.documentMeta,
  });

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

      const i18n = await getI18nInstance(emailLanguage);

      const recipientEmailType = RECIPIENT_ROLE_TO_EMAIL_TYPE[recipient.role];

      const { email, name } = recipient;
      const selfSigner = email === user.email;

      const recipientActionVerb = i18n._(RECIPIENT_ROLES_DESCRIPTION[recipient.role].actionVerb).toLowerCase();

      let emailMessage = envelope.documentMeta.message || '';
      let emailSubject = i18n._(msg`Reminder: Please ${recipientActionVerb} this document`);

      if (selfSigner) {
        emailMessage = i18n._(
          msg`You have initiated the document ${`"${envelope.title}"`} that requires you to ${recipientActionVerb} it.`,
        );
        emailSubject = i18n._(msg`Reminder: Please ${recipientActionVerb} your document`);
      }

      if (organisationType === OrganisationType.ORGANISATION) {
        emailSubject = i18n._(msg`Reminder: ${envelope.team.name} invited you to ${recipientActionVerb} a document`);
        emailMessage =
          envelope.documentMeta.message ||
          i18n._(
            msg`${user.name || user.email} on behalf of "${envelope.team.name}" has invited you to ${recipientActionVerb} the document "${envelope.title}".`,
          );
      }

      const customEmailTemplate = {
        'signer.name': name,
        'signer.email': email,
        'document.name': envelope.title,
      };

      const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';
      const signDocumentLink = `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`;
      const reportUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/report/${recipient.token}`;

      const template = createElement(DocumentInviteEmailTemplate, {
        documentName: envelope.title,
        inviterName: user.name || undefined,
        inviterEmail:
          organisationType === OrganisationType.ORGANISATION
            ? envelope.team?.teamEmail?.email || user.email
            : user.email,
        assetBaseUrl,
        signDocumentLink,
        customBody: renderCustomEmailTemplate(emailMessage, customEmailTemplate),
        role: recipient.role,
        selfSigner,
        organisationType,
        teamName: envelope.team?.name,
        reportUrl,
      });

      const [html, text] = await Promise.all([
        renderEmailWithI18N(template, {
          lang: emailLanguage,
          branding,
        }),
        renderEmailWithI18N(template, {
          lang: emailLanguage,
          branding,
          plainText: true,
        }),
      ]);

      // Send email outside any transaction to avoid holding a connection
      // open during network I/O.
      await emailTransport.sendMail({
        to: {
          address: email,
          name,
        },
        from: senderEmail,
        replyTo: replyToEmail,
        subject: envelope.documentMeta.subject
          ? renderCustomEmailTemplate(i18n._(msg`Reminder: ${envelope.documentMeta.subject}`), customEmailTemplate)
          : emailSubject,
        html,
        text,
        headers: buildEnvelopeEmailHeaders({
          userId: envelope.userId,
          envelopeId: envelope.id,
          teamId: envelope.teamId,
        }),
      });

      // Mark the recipient as sent if they were not already sent.
      await prisma.recipient.updateMany({
        where: {
          id: recipient.id,
          sendStatus: SendStatus.NOT_SENT,
        },
        data: {
          sendStatus: SendStatus.SENT,
          sentAt: new Date(),
        },
      });

      await prisma.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
          envelopeId: envelope.id,
          metadata: requestMetadata,
          data: {
            emailType: recipientEmailType,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            recipientRole: recipient.role,
            recipientId: recipient.id,
            isResending: true,
          },
        }),
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
