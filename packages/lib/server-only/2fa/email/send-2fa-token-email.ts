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
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../../types/document-audit-logs';
import { createDocumentAuditLogData } from '../../../utils/document-audit-logs';
import { unsafeBuildEnvelopeIdQuery } from '../../../utils/envelope';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import { getEmailContext } from '../../email/get-email-context';
import { TWO_FACTOR_EMAIL_EXPIRATION_MINUTES } from './constants';
import { generateTwoFactorTokenFromEmail } from './generate-2fa-token-from-email';

export type Send2FATokenEmailOptions = {
  token: string;
  envelopeId: string;
};

export const send2FATokenEmail = async ({ token, envelopeId }: Send2FATokenEmailOptions) => {
  const envelope = await prisma.envelope.findFirst({
    where: {
      ...unsafeBuildEnvelopeIdQuery(
        {
          type: 'envelopeId',
          id: envelopeId,
        },
        EnvelopeType.DOCUMENT,
      ),
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
          envelopeId: envelope.id,
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
