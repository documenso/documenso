import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import DocumentInviteEmailTemplate from '@documenso/email/templates/document-invite';
import { prisma } from '@documenso/prisma';
import type { DocumentReminderInterval } from '@documenso/prisma/client';
import { DocumentStatus, RecipientRole, SendStatus, SigningStatus } from '@documenso/prisma/client';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { FROM_ADDRESS, FROM_NAME } from '../../../constants/email';
import { RECIPIENT_ROLES_DESCRIPTION } from '../../../constants/recipient-roles';
import { extractDerivedDocumentEmailSettings } from '../../../types/document-email';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import { shouldSendReminder } from '../../../utils/should-send-reminder';
import type { JobRunIO } from '../../client/_internal/job';

// TODO: Add Audit Log import and usage

export type SendReminderHandlerOptions = {
  io: JobRunIO;
  interval: DocumentReminderInterval;
};

export async function run({ io, interval }: SendReminderHandlerOptions) {
  const now = new Date();

  const documentsToSendReminders = await io.runTask(
    `find-documents-for-${interval.toLocaleUpperCase()}-reminder`,
    async () => {
      const documents = await prisma.document.findMany({
        where: {
          status: DocumentStatus.PENDING,
          documentMeta: {
            reminderInterval: {
              equals: interval,
            },
          },
          deletedAt: null,
        },
        include: {
          documentMeta: true,
          user: true,
          recipients: {
            where: {
              signingStatus: SigningStatus.NOT_SIGNED,
              role: {
                not: RecipientRole.CC,
              },
            },
          },
        },
      });

      const filteredDocuments = documents.filter((document) => {
        const { documentMeta } = document;
        if (!documentMeta) {
          io.logger.warn(`Filtering out document ${document.id} due to missing documentMeta.`);
          return false;
        }

        const { reminderInterval, lastReminderSentAt } = documentMeta;
        const shouldSend = shouldSendReminder({
          reminderInterval,
          lastReminderSentAt,
          now,
        });

        return shouldSend;
      });

      io.logger.info(
        `Found ${filteredDocuments.length} documents after filtering for interval ${interval}.`,
        filteredDocuments.map((d) => ({ id: d.id })),
      );

      return filteredDocuments;
    },
  );

  if (documentsToSendReminders.length === 0) {
    io.logger.info(`No documents found needing ${interval.toLocaleUpperCase()} reminders.`);
    return;
  }

  io.logger.info(
    `Found ${documentsToSendReminders.length} documents needing ${interval.toLocaleUpperCase()} reminders.`,
  );

  for (const document of documentsToSendReminders) {
    if (!document.documentMeta) {
      io.logger.warn(`Skipping document ${document.id} due to missing documentMeta.`);
      continue;
    }

    if (!extractDerivedDocumentEmailSettings(document.documentMeta).recipientSigningRequest) {
      io.logger.info(`Skipping document ${document.id} due to email settings.`);
      continue;
    }

    for (const recipient of document.recipients) {
      try {
        const i18n = await getI18nInstance(document.documentMeta.language);
        const recipientActionVerb = i18n
          ._(RECIPIENT_ROLES_DESCRIPTION[recipient.role].actionVerb)
          .toLowerCase();

        const emailSubject = i18n._(
          msg`Reminder: Please ${recipientActionVerb} the document "${document.title}"`,
        );
        const emailMessage = i18n._(
          msg`This is a reminder to ${recipientActionVerb} the document "${document.title}". Please complete this at your earliest convenience.`,
        );

        const signDocumentLink = `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`;
        const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

        const template = createElement(DocumentInviteEmailTemplate, {
          documentName: document.title,
          inviterName: document.user.name || undefined,
          inviterEmail: document.user.email,
          assetBaseUrl,
          signDocumentLink,
          customBody: emailMessage,
          role: recipient.role,
          selfSigner: recipient.email === document.user.email,
        });

        await io.runTask(`send-reminder-${recipient.id}`, async () => {
          const [html, text] = await Promise.all([
            renderEmailWithI18N(template, { lang: document.documentMeta?.language }),
            renderEmailWithI18N(template, {
              lang: document.documentMeta?.language,
              plainText: true,
            }),
          ]);

          await mailer.sendMail({
            to: {
              name: recipient.name,
              address: recipient.email,
            },
            from: {
              name: FROM_NAME,
              address: FROM_ADDRESS,
            },
            subject: emailSubject,
            html,
            text,
          });

          // Update recipient status (might be redundant if only tracking lastReminderSentAt on DocumentMeta)
          await prisma.recipient.update({
            where: { id: recipient.id },
            data: { sendStatus: SendStatus.SENT },
          });
        });

        // TODO: Duncan == Audit log
        // await io.runTask(`log-reminder-${recipient.id}`, async () => {
        //   await prisma.documentAuditLog.create(...);
        // });
      } catch (error) {
        io.logger.error(`Error processing reminder for recipient ${recipient.id}`, error);
      }
    }

    try {
      await io.runTask(`update-meta-${document.id}`, async () => {
        await prisma.documentMeta.update({
          where: { documentId: document.id },
          data: { lastReminderSentAt: now },
        });
      });
      io.logger.info(`Updated lastReminderSentAt for document ${document.id}`);
    } catch (error) {
      io.logger.error(`Error updating lastReminderSentAt for document ${document.id}`, error);
    }
  }
}
