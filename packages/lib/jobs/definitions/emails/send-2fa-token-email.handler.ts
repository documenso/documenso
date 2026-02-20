import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import { EnvelopeType } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import { AccessAuth2FAEmailTemplate } from '@documenso/email/templates/access-auth-2fa';
import { isRecipientEmailValidForSending } from '@documenso/lib/utils/recipients';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { AppError, AppErrorCode } from '../../../errors/app-error';
import { TWO_FACTOR_EMAIL_EXPIRATION_MINUTES } from '../../../server-only/2fa/email/constants';
import { generateTwoFactorTokenFromEmail } from '../../../server-only/2fa/email/generate-2fa-token-from-email';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../../types/document-audit-logs';
import { createDocumentAuditLogData } from '../../../utils/document-audit-logs';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSend2FATokenEmailJobDefinition } from './send-2fa-token-email';

export const run = async ({
  payload,
  io,
}: {
  payload: TSend2FATokenEmailJobDefinition;
  io: JobRunIO;
}) => {
  const { envelopeId, recipientId } = payload;

  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
      type: EnvelopeType.DOCUMENT,
      recipients: {
        some: {
          id: recipientId,
        },
      },
    },
    include: {
      recipients: {
        where: {
          id: recipientId,
        },
      },
      documentMeta: true,
      team: {
        select: {
          teamEmail: true,
          name: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const [recipient] = envelope.recipients;

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found',
    });
  }

  if (!isRecipientEmailValidForSending(recipient)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Recipient is missing email address',
    });
  }

  const twoFactorTokenToken = await generateTwoFactorTokenFromEmail({
    envelopeId,
    email: recipient.email,
  });

  const { branding, emailLanguage, senderEmail, replyToEmail } = await getEmailContext({
    emailType: 'RECIPIENT',
    source: {
      type: 'team',
      teamId: envelope.teamId,
    },
    meta: envelope.documentMeta,
  });

  const i18n = await getI18nInstance(emailLanguage);

  const subject = i18n._(msg`Your two-factor authentication code`);

  const template = createElement(AccessAuth2FAEmailTemplate, {
    documentTitle: envelope.title,
    userName: recipient.name,
    userEmail: recipient.email,
    code: twoFactorTokenToken,
    expiresInMinutes: TWO_FACTOR_EMAIL_EXPIRATION_MINUTES,
    assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(template, { lang: emailLanguage, branding }),
    renderEmailWithI18N(template, { lang: emailLanguage, branding, plainText: true }),
  ]);

  await mailer.sendMail({
    to: {
      address: recipient.email,
      name: recipient.name,
    },
    from: senderEmail,
    replyTo: replyToEmail,
    subject,
    html,
    text,
  });

  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_ACCESS_AUTH_2FA_REQUESTED,
      envelopeId: envelope.id,
      data: {
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        recipientId: recipient.id,
      },
    }),
  });
};
