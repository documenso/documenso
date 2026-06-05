import DocumentCancelTemplate from '@documenso/email/templates/document-cancel';
import { isRecipientEmailValidForSending } from '@documenso/lib/utils/recipients';
import { prisma } from '@documenso/prisma';
import { msg } from '@lingui/core/macro';
import { EnvelopeType, ReadStatus, RecipientRole, SendStatus, SigningStatus } from '@prisma/client';
import { createElement } from 'react';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { assertOrganisationRatesAndLimits } from '../../../server-only/rate-limit/assert-organisation-rates-and-limits';
import { extractDerivedDocumentEmailSettings } from '../../../types/document-email';
import { unsafeBuildEnvelopeIdQuery } from '../../../utils/envelope';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendDocumentCancelledEmailsJobDefinition } from './send-document-cancelled-emails';

export const run = async ({ payload, io }: { payload: TSendDocumentCancelledEmailsJobDefinition; io: JobRunIO }) => {
  const { documentId, cancellationReason } = payload;

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: unsafeBuildEnvelopeIdQuery(
      {
        type: 'documentId',
        id: documentId,
      },
      EnvelopeType.DOCUMENT,
    ),
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          disabled: true,
        },
      },
      documentMeta: true,
      recipients: true,
      team: {
        select: {
          teamEmail: true,
          name: true,
          url: true,
        },
      },
    },
  });

  const { branding, emailLanguage, senderEmail, replyToEmail, organisationId, claims, emailsDisabled, emailTransport } =
    await getEmailContext({
      emailType: 'RECIPIENT',
      source: {
        type: 'team',
        teamId: envelope.teamId,
      },
      meta: envelope.documentMeta,
    });

  const { documentMeta, user: documentOwner } = envelope;

  // Don't send cancellation emails if the organisation has email sending disabled or the owner is disabled (e.g. banned).
  if (emailsDisabled || documentOwner.disabled) {
    return;
  }

  // A recipientCount of 0 means unlimited recipients are allowed.
  const maximumRecipientCount = claims.recipientCount;

  if (maximumRecipientCount > 0 && envelope.recipients.length > maximumRecipientCount) {
    io.logger.warn({
      msg: 'Cancellation email dropped: org recipient limit exceeded',
      organisationId,
      recipientCount: envelope.recipients.length,
      maximumRecipientCount,
      envelopeId: envelope.id,
    });

    return;
  }

  // Check if document cancellation emails are enabled
  const isEmailEnabled = extractDerivedDocumentEmailSettings(documentMeta).documentDeleted;

  if (!isEmailEnabled) {
    return;
  }

  const i18n = await getI18nInstance(emailLanguage);

  // Send cancellation emails to recipients who have been sent the document or viewed it.
  // CC recipients are excluded because they were never actually emailed about the document
  // (CC recipients are created with sendStatus=SENT by default but never receive a signing
  // invitation), so notifying them about a cancellation they never knew about is unsolicited.
  const recipientsToNotify = envelope.recipients.filter(
    (recipient) =>
      recipient.role !== RecipientRole.CC &&
      (recipient.sendStatus === SendStatus.SENT || recipient.readStatus === ReadStatus.OPENED) &&
      recipient.signingStatus !== SigningStatus.REJECTED &&
      isRecipientEmailValidForSending(recipient),
  );

  await io.runTask('send-cancellation-emails', async () => {
    await Promise.all(
      recipientsToNotify.map(async (recipient) => {
        // Meter the cancellation email against the organisation email quota/stats.
        // The recipient never opted in, so this notification is unsolicited and
        // must be bounded by the same org limits as other outbound emails.
        try {
          await assertOrganisationRatesAndLimits({
            organisationId,
            organisationClaim: claims,
            type: 'email',
            count: 1,
          });
        } catch (_err) {
          io.logger.warn({
            msg: 'Cancellation email dropped: org email limit exceeded',
            organisationId,
            recipientId: recipient.id,
            envelopeId: envelope.id,
          });

          // On rate/quota exceeded, skip this recipient and continue with the rest.
          return;
        }

        const template = createElement(DocumentCancelTemplate, {
          documentName: envelope.title,
          inviterName: documentOwner.name || undefined,
          inviterEmail: documentOwner.email,
          assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
          cancellationReason: cancellationReason || 'The document has been cancelled.',
        });

        const [html, text] = await Promise.all([
          renderEmailWithI18N(template, { lang: emailLanguage, branding }),
          renderEmailWithI18N(template, {
            lang: emailLanguage,
            branding,
            plainText: true,
          }),
        ]);

        await emailTransport.sendMail({
          to: {
            name: recipient.name,
            address: recipient.email,
          },
          from: senderEmail,
          replyTo: replyToEmail,
          subject: i18n._(msg`Document "${envelope.title}" Cancelled`),
          html,
          text,
        });
      }),
    );
  });
};
