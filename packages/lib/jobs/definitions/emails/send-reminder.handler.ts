import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import DocumentReminderEmailTemplate from '@documenso/email/templates/document-reminder';
import { prisma } from '@documenso/prisma';
import type { DocumentReminderInterval } from '@documenso/prisma/client';
import { DocumentStatus, RecipientRole, SendStatus, SigningStatus } from '@documenso/prisma/client';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { FROM_ADDRESS, FROM_NAME } from '../../../constants/email';
import { RECIPIENT_ROLES_DESCRIPTION } from '../../../constants/recipient-roles';
import { DOCUMENT_AUDIT_LOG_TYPE, DOCUMENT_EMAIL_TYPE } from '../../../types/document-audit-logs';
import { extractDerivedDocumentEmailSettings } from '../../../types/document-email';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import { shouldSendReminder } from '../../../utils/should-send-reminder';
import type { JobRunIO } from '../../client/_internal/job';

export type SendReminderHandlerOptions = {
  io: JobRunIO;
  intervals: DocumentReminderInterval[];
};

export async function run({ io, intervals }: SendReminderHandlerOptions) {
  const now = new Date();
  const intervalsString = intervals.join(',').toLowerCase();

  const envelopesToSendReminders = await io.runTask(
    `find-documents-for-${intervalsString}-reminder`,
    async () => {
      const envelopes = await prisma.envelope.findMany({
        where: {
          status: DocumentStatus.PENDING,
          documentMeta: {
            reminderInterval: {
              in: intervals,
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

      const filteredEnvelopes = envelopes.filter((envelope) => {
        const { documentMeta } = envelope;
        if (!documentMeta) {
          io.logger.warn(`Filtering out envelope ${envelope.id} due to missing documentMeta.`);
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
        `Found ${filteredEnvelopes.length} envelopes after filtering for interval ${intervalsString}.`,
        filteredEnvelopes.map((e) => ({ id: e.id })),
      );

      return filteredEnvelopes;
    },
  );

  if (envelopesToSendReminders.length === 0) {
    io.logger.info(`No envelopes found needing ${intervalsString} reminders.`);
    return;
  }

  io.logger.info(
    `Found ${envelopesToSendReminders.length} envelopes needing ${intervalsString} reminders.`,
  );

  for (const envelope of envelopesToSendReminders) {
    if (!envelope.documentMeta) {
      io.logger.warn(`Skipping envelope ${envelope.id} due to missing documentMeta.`);
      continue;
    }

    if (!extractDerivedDocumentEmailSettings(envelope.documentMeta).recipientSigningRequest) {
      io.logger.info(`Skipping envelope ${envelope.id} due to email settings.`);
      continue;
    }

    for (const recipient of envelope.recipients) {
      try {
        const i18n = await getI18nInstance(envelope.documentMeta.language);
        const recipientActionVerb = i18n
          ._(RECIPIENT_ROLES_DESCRIPTION[recipient.role].actionVerb)
          .toLowerCase();

        const emailSubject = i18n._(
          msg`Reminder: Please ${recipientActionVerb} the document "${envelope.title}"`,
        );
        const emailMessage = i18n._(
          msg`This is a reminder to ${recipientActionVerb} the document "${envelope.title}". Please complete this at your earliest convenience.`,
        );

        const signDocumentLink = `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`;
        const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

        const template = createElement(DocumentReminderEmailTemplate, {
          recipientName: recipient.name,
          documentName: envelope.title,
          assetBaseUrl,
          signDocumentLink,
          customBody: emailMessage,
          role: recipient.role,
        });

        await io.runTask(`send-reminder-${recipient.id}`, async () => {
          const [html, text] = await Promise.all([
            renderEmailWithI18N(template, { lang: envelope.documentMeta?.language }),
            renderEmailWithI18N(template, {
              lang: envelope.documentMeta?.language,
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

          await prisma.recipient.update({
            where: { id: recipient.id },
            data: { sendStatus: SendStatus.SENT },
          });
        });

        await io.runTask(`log-reminder-${recipient.id}`, async () => {
          await prisma.documentAuditLog.create({
            data: {
              type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
              envelopeId: envelope.id,
              userId: envelope.userId,
              data: {
                type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
                data: {
                  recipientEmail: recipient.email,
                  recipientName: recipient.name,
                  recipientId: recipient.id,
                  recipientRole: recipient.role,
                  emailType: DOCUMENT_EMAIL_TYPE.REMINDER,
                  isResending: false,
                },
              },
              ipAddress: undefined,
            },
          });
        });
      } catch (error) {
        io.logger.error(`Error processing reminder for recipient ${recipient.id}`, error);
      }
    }

    try {
      await io.runTask(`update-meta-${envelope.id}`, async () => {
        await prisma.documentMeta.update({
          where: { id: envelope.documentMetaId },
          data: { lastReminderSentAt: now },
        });
      });
      io.logger.info(`Updated lastReminderSentAt for envelope ${envelope.id}`);
    } catch (error) {
      io.logger.error(`Error updating lastReminderSentAt for envelope ${envelope.id}`, error);
    }
  }
}
