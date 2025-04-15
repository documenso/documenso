import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import DocumentInviteEmailTemplate from '@documenso/email/templates/document-invite';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, RecipientRole, SendStatus } from '@documenso/prisma/client';
import { DocumentReminderInterval, SigningStatus } from '@documenso/prisma/generated/types';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { FROM_ADDRESS, FROM_NAME } from '../../../constants/email';
import { RECIPIENT_ROLES_DESCRIPTION } from '../../../constants/recipient-roles';
import { extractDerivedDocumentEmailSettings } from '../../../types/document-email';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import { shouldSendReminder } from '../../../utils/should-send-reminder';
import type { JobDefinition, JobRunIO } from '../../client/_internal/job';

export type SendSigningReminderEmailHandlerOptions = {
  io: JobRunIO;
};

const SEND_SIGNING_REMINDER_EMAIL_JOB_ID = 'send.signing.reminder.email';

export const SEND_SIGNING_REMINDER_EMAIL_JOB = {
  id: SEND_SIGNING_REMINDER_EMAIL_JOB_ID,
  name: 'Send Signing Reminder Email',
  version: '1.0.0',
  trigger: {
    type: 'cron',
    schedule: '*/5 * * * *',
    name: SEND_SIGNING_REMINDER_EMAIL_JOB_ID,
  },
  handler: async ({ io }) => {
    const now = new Date();

    const documentWithReminders = await prisma.document.findMany({
      where: {
        status: DocumentStatus.PENDING,
        documentMeta: {
          reminderInterval: {
            not: DocumentReminderInterval.NONE,
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

    console.log(documentWithReminders);

    for (const document of documentWithReminders) {
      if (!extractDerivedDocumentEmailSettings(document.documentMeta).recipientSigningRequest) {
        continue;
      }

      const { documentMeta } = document;
      if (!documentMeta) {
        return;
      }

      const { reminderInterval, lastReminderSentAt } = documentMeta;
      if (
        !shouldSendReminder({
          reminderInterval,
          lastReminderSentAt,
          now,
        })
      ) {
        continue;
      }

      for (const recipient of document.recipients) {
        const i18n = await getI18nInstance(document.documentMeta?.language);
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

        await io.runTask('send-reminder-email', async () => {
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
        });

        await io.runTask('update-recipient-status', async () => {
          await prisma.recipient.update({
            where: { id: recipient.id },
            data: { sendStatus: SendStatus.SENT },
          });
        });

        // TODO: Duncan == Audit log
        // await io.runTask('store-reminder-audit-log', async () => {
        //   await prisma.documentAuditLog.create({
        //     data: createDocumentAuditLogData({
        //       type: DOCUMENT_AUDIT_LOG_TYPE.REMINDER_SENT,
        //       documentId: document.id,
        //       user,
        //       requestMetadata,
        //       data: {
        //         recipientId: recipient.id,
        //         recipientName: recipient.name,
        //         recipientEmail: recipient.email,
        //         recipientRole: recipient.role,
        //       },
        //     }),
        //   });
        // });
      }

      await prisma.documentMeta.update({
        where: { id: document.documentMeta?.id },
        data: { lastReminderSentAt: now },
      });
    }
  },
} as const satisfies JobDefinition<typeof SEND_SIGNING_REMINDER_EMAIL_JOB_ID>;
