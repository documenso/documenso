import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { mailer } from '@documenso/email/mailer';
import { AccessAuth2FAEmailTemplate } from '@documenso/email/templates/access-auth-2fa';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { AppError, AppErrorCode } from '../../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../../types/document-audit-logs';
import { createDocumentAuditLogData } from '../../../utils/document-audit-logs';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import { getEmailContext } from '../../email/get-email-context';
import { TWO_FACTOR_EMAIL_EXPIRATION_MINUTES } from './constants';
import { generateTwoFactorTokenFromEmail } from './generate-2fa-token-from-email';

export type Send2FATokenEmailOptions = {
  token: string;
  documentId: number;
};

export const send2FATokenEmail = async ({ token, documentId }: Send2FATokenEmailOptions) => {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      recipients: {
        some: {
          token,
        },
      },
    },
    include: {
      recipients: {
        where: {
          token,
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

  if (!document) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const [recipient] = document.recipients;

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found',
    });
  }

  const twoFactorTokenToken = await generateTwoFactorTokenFromEmail({
    documentId,
    email: recipient.email,
  });

  const { branding, emailLanguage, senderEmail, replyToEmail } = await getEmailContext({
    emailType: 'RECIPIENT',
    source: {
      type: 'team',
      teamId: document.teamId,
    },
    meta: document.documentMeta,
  });

  const i18n = await getI18nInstance(emailLanguage);

  const subject = i18n._(msg`Your two-factor authentication code`);

  const template = createElement(AccessAuth2FAEmailTemplate, {
    documentTitle: document.title,
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

  await prisma.$transaction(
    async (tx) => {
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

      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_ACCESS_AUTH_2FA_REQUESTED,
          documentId: document.id,
          data: {
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            recipientId: recipient.id,
          },
        }),
      });
    },
    { timeout: 30_000 },
  );
};
