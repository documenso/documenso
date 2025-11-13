import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import { EnvelopeType, SigningStatus } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import TemplateDocumentReminder from '@documenso/email/template-components/template-document-remainder';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { extractDerivedDocumentEmailSettings } from '../../../types/document-email';
import { unsafeBuildEnvelopeIdQuery } from '../../../utils/envelope';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';

export interface TSendDocumentReminderEmailsJobHandlerPayload {
  documentId: number;
  requestMetadata?: string;
}

export const run = async ({
  payload,
  io,
}: {
  payload: TSendDocumentReminderEmailsJobHandlerPayload;
  io: JobRunIO;
}) => {
  const { documentId } = payload;

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
      teamId: envelope.teamId,
    },
    meta: envelope.documentMeta,
  });

  const isReminderEnabled = extractDerivedDocumentEmailSettings(
    envelope.documentMeta,
  ).documentReminder;
  if (!isReminderEnabled) return;

  const i18n = await getI18nInstance(emailLanguage);

  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const unsignedRecipients = envelope.recipients.filter(
    (r) => r.signingStatus !== SigningStatus.SIGNED,
  );

  await io.runTask('send-document-reminder-emails', async () => {
    await Promise.all(
      unsignedRecipients.map(async (recipient) => {
        // ✅ Check if this recipient has already been reminded in the last 48 hours

        const alreadyReminded = await prisma.reminderLog.findFirst({
          where: {
            envelopeId: envelope.id,
            recipientId: String(recipient.id),
            sentAt: { gte: fortyEightHoursAgo },
          },
        });
        if (alreadyReminded) return; // skip this recipient

        const template = createElement(TemplateDocumentReminder, {
          documentName: envelope.title,
          assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
        });

        const [html, text] = await Promise.all([
          renderEmailWithI18N(template, { lang: emailLanguage, branding }),
          renderEmailWithI18N(template, { lang: emailLanguage, branding, plainText: true }),
        ]);

        await mailer.sendMail({
          to: { name: recipient.name, address: recipient.email },
          from: senderEmail,
          replyTo: replyToEmail,
          subject: i18n._(msg`Reminder: Pending signature for "${envelope.title}"`),
          html,
          text,
        });

        // ✅ Log that we sent a reminder
        await prisma.reminderLog.create({
          data: {
            envelopeId: envelope.id,
            recipientId: String(recipient.id),
          },
        });
      }),
    );
  });
};
