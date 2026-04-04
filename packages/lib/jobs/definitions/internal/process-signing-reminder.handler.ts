import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import { DocumentStatus, RecipientRole, SigningStatus, WebhookTriggerEvents } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import DocumentReminderEmailTemplate from '@documenso/email/templates/document-reminder';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { FROM_ADDRESS, FROM_NAME } from '../../../constants/email';
import { RECIPIENT_ROLES_DESCRIPTION } from '../../../constants/recipient-roles';
import { triggerWebhook } from '../../../server-only/webhooks/trigger/trigger-webhook';
import { DOCUMENT_AUDIT_LOG_TYPE, DOCUMENT_EMAIL_TYPE } from '../../../types/document-audit-logs';
import { extractDerivedDocumentEmailSettings } from '../../../types/document-email';
import {
  ZWebhookDocumentSchema,
  mapEnvelopeToWebhookDocumentPayload,
} from '../../../types/webhook-payload';
import { createDocumentAuditLogData } from '../../../utils/document-audit-logs';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TProcessSigningReminderJobDefinition } from './process-signing-reminder';

export const run = async ({
  payload,
  io,
}: {
  payload: TProcessSigningReminderJobDefinition;
  io: JobRunIO;
}) => {
  const { envelopeId } = payload;
  const now = new Date();

  // Atomically claim this reminder by setting lastReminderSentAt.
  // This prevents duplicate sends from concurrent workers.
  const updatedCount = await io.runTask('claim-reminder', async () => {
    const result = await prisma.documentMeta.updateMany({
      where: {
        envelope: {
          id: envelopeId,
          status: DocumentStatus.PENDING,
          deletedAt: null,
        },
      },
      data: {
        lastReminderSentAt: now,
      },
    });

    return result.count;
  });

  if (updatedCount === 0) {
    io.logger.info(`Envelope ${envelopeId} no longer eligible for reminder, skipping`);
    return;
  }

  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
      status: DocumentStatus.PENDING,
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

  if (!envelope || !envelope.documentMeta) {
    io.logger.warn(`Envelope ${envelopeId} not found or missing documentMeta`);
    return;
  }

  if (!extractDerivedDocumentEmailSettings(envelope.documentMeta).recipientSigningRequest) {
    io.logger.info(`Envelope ${envelopeId} has email signing requests disabled, skipping`);
    return;
  }

  if (envelope.recipients.length === 0) {
    io.logger.info(`Envelope ${envelopeId} has no unsigned recipients, skipping`);
    return;
  }

  io.logger.info(
    `Sending signing reminders for envelope ${envelopeId} to ${envelope.recipients.length} recipients`,
  );

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

      await io.runTask(`send-reminder-email-${recipient.id}`, async () => {
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
      });

      await io.runTask(`audit-log-reminder-${recipient.id}`, async () => {
        await prisma.documentAuditLog.create({
          data: createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
            envelopeId: envelope.id,
            data: {
              recipientEmail: recipient.email,
              recipientName: recipient.name,
              recipientId: recipient.id,
              recipientRole: recipient.role,
              emailType: DOCUMENT_EMAIL_TYPE.REMINDER,
              isResending: false,
            },
          }),
        });
      });
    } catch (error) {
      io.logger.error(`Error sending reminder to recipient ${recipient.id}:`, error);
    }
  }

  // Trigger webhook for reminder sent.
  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_REMINDER_SENT,
    data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(envelope)),
    userId: envelope.userId,
    teamId: envelope.teamId,
  });
};
