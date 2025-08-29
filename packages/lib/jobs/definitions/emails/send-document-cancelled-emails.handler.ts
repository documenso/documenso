import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import { ReadStatus, SendStatus, SigningStatus } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import DocumentCancelTemplate from '@documenso/email/templates/document-cancel';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { extractDerivedDocumentEmailSettings } from '../../../types/document-email';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendDocumentCancelledEmailsJobDefinition } from './send-document-cancelled-emails';

export const run = async ({
  payload,
  io,
}: {
  payload: TSendDocumentCancelledEmailsJobDefinition;
  io: JobRunIO;
}) => {
  const { documentId, cancellationReason } = payload;

  const document = await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
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

  const { branding, emailLanguage, senderEmail, replyToEmail } = await getEmailContext({
    emailType: 'RECIPIENT',
    source: {
      type: 'team',
      teamId: document.teamId,
    },
    meta: document.documentMeta,
  });

  const { documentMeta, user: documentOwner } = document;

  // Check if document cancellation emails are enabled
  const isEmailEnabled = extractDerivedDocumentEmailSettings(documentMeta).documentDeleted;

  if (!isEmailEnabled) {
    return;
  }

  const i18n = await getI18nInstance(emailLanguage);

  // Send cancellation emails to all recipients who have been sent the document or viewed it
  const recipientsToNotify = document.recipients.filter(
    (recipient) =>
      (recipient.sendStatus === SendStatus.SENT || recipient.readStatus === ReadStatus.OPENED) &&
      recipient.signingStatus !== SigningStatus.REJECTED,
  );

  await io.runTask('send-cancellation-emails', async () => {
    await Promise.all(
      recipientsToNotify.map(async (recipient) => {
        const template = createElement(DocumentCancelTemplate, {
          documentName: document.title,
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

        await mailer.sendMail({
          to: {
            name: recipient.name,
            address: recipient.email,
          },
          from: senderEmail,
          replyTo: replyToEmail,
          subject: i18n._(msg`Document "${document.title}" Cancelled`),
          html,
          text,
        });
      }),
    );
  });
};
