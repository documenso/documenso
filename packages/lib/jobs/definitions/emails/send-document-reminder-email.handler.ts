import DocumentInviteEmailTemplate from '@documenso/email/templates/document-invite';
import { prisma } from '@documenso/prisma';
import { msg } from '@lingui/core/macro';
import {
  DocumentStatus,
  EnvelopeType,
  OrganisationType,
  RecipientRole,
  SendStatus,
  SigningStatus,
} from '@prisma/client';
import { createElement } from 'react';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { RECIPIENT_ROLE_TO_EMAIL_TYPE, RECIPIENT_ROLES_DESCRIPTION } from '../../../constants/recipient-roles';
import { buildEnvelopeEmailHeaders } from '../../../server-only/email/build-envelope-email-headers';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../../types/document-audit-logs';
import { extractDerivedDocumentEmailSettings } from '../../../types/document-email';
import { createDocumentAuditLogData } from '../../../utils/document-audit-logs';
import { unsafeBuildEnvelopeIdQuery } from '../../../utils/envelope';
import { isRecipientEmailValidForSending } from '../../../utils/recipients';
import { renderCustomEmailTemplate } from '../../../utils/render-custom-email-template';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendDocumentReminderEmailJobDefinition } from './send-document-reminder-email';

export const run = async ({ payload, io }: { payload: TSendDocumentReminderEmailJobDefinition; io: JobRunIO }) => {
  const { userId, documentId, recipientId, requestMetadata, auditUser } = payload;

  const [user, envelope, recipient] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        disabled: true,
      },
    }),
    prisma.envelope.findFirst({
      where: {
        ...unsafeBuildEnvelopeIdQuery(
          {
            type: 'documentId',
            id: documentId,
          },
          EnvelopeType.DOCUMENT,
        ),
        status: DocumentStatus.PENDING,
      },
      include: {
        documentMeta: true,
        team: {
          select: {
            teamEmail: true,
            name: true,
          },
        },
      },
    }),
    prisma.recipient.findFirst({
      where: {
        id: recipientId,
      },
    }),
  ]);

  // The decision to remind these recipients (validation, email-enabled gate,
  // owner/org disabled gate, rate-limit metering, per-recipient role/email
  // filtering) was made synchronously in `resendDocument` before this job was
  // enqueued. If any entity vanished between enqueue and run, no-op.
  if (!user || !envelope || !recipient) {
    return;
  }

  // Skip recipients that can't / shouldn't be reminded. Re-checked at send
  // time because the recipient may have signed between enqueue and run. Also
  // narrows `recipient.role` away from CC for the email-type lookup below.
  if (
    recipient.role === RecipientRole.CC ||
    recipient.signingStatus === SigningStatus.SIGNED ||
    !isRecipientEmailValidForSending(recipient)
  ) {
    return;
  }

  const isRecipientSigningRequestEmailEnabled = extractDerivedDocumentEmailSettings(
    envelope.documentMeta,
  ).recipientSigningRequest;

  if (!isRecipientSigningRequestEmailEnabled) {
    return;
  }

  const { branding, emailLanguage, organisationType, senderEmail, replyToEmail, emailsDisabled, emailTransport } =
    await getEmailContext({
      emailType: 'RECIPIENT',
      source: {
        type: 'team',
        teamId: envelope.teamId,
      },
      meta: envelope.documentMeta,
    });

  // Don't send reminders if the owner is disabled (e.g. banned) or the
  // organisation has email sending disabled. Re-checked here because the org
  // state can change between enqueue and run.
  if (user.disabled || emailsDisabled) {
    return;
  }

  const i18n = await getI18nInstance(emailLanguage);

  const recipientEmailType = RECIPIENT_ROLE_TO_EMAIL_TYPE[recipient.role];

  const { email, name } = recipient;
  const selfSigner = email === user.email;

  const recipientActionVerb = i18n._(RECIPIENT_ROLES_DESCRIPTION[recipient.role].actionVerb).toLowerCase();

  let emailMessage = envelope.documentMeta?.message || '';
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
      envelope.documentMeta?.message ||
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
      organisationType === OrganisationType.ORGANISATION ? envelope.team?.teamEmail?.email || user.email : user.email,
    assetBaseUrl,
    signDocumentLink,
    customBody: renderCustomEmailTemplate(emailMessage, customEmailTemplate),
    role: recipient.role,
    selfSigner,
    organisationType,
    teamName: envelope.team?.name,
    reportUrl,
  });

  await io.runTask('send-document-reminder-email', async () => {
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

    await emailTransport.sendMail({
      to: {
        address: email,
        name,
      },
      from: senderEmail,
      replyTo: replyToEmail,
      subject: envelope.documentMeta?.subject
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
      user: auditUser,
      requestMetadata,
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
};
