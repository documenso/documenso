import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import { SendStatus, SigningStatus } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import DocumentRejectedEmail from '@documenso/email/templates/document-rejected';
import DocumentRejectionConfirmedEmail from '@documenso/email/templates/document-rejection-confirmed';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { FROM_ADDRESS, FROM_NAME } from '../../../constants/email';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { extractDerivedDocumentEmailSettings } from '../../../types/document-email';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import { formatDocumentsPath } from '../../../utils/teams';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendSigningRejectionEmailsJobDefinition } from './send-rejection-emails';

export const run = async ({
  payload,
  io,
}: {
  payload: TSendSigningRejectionEmailsJobDefinition;
  io: JobRunIO;
}) => {
  const { documentId, recipientId } = payload;

  const [document, recipient] = await Promise.all([
    prisma.document.findFirstOrThrow({
      where: {
        id: documentId,
      },
      include: {
        user: true,
        documentMeta: true,
        team: {
          select: {
            teamEmail: true,
            name: true,
            url: true,
          },
        },
      },
    }),
    prisma.recipient.findFirstOrThrow({
      where: {
        id: recipientId,
        signingStatus: SigningStatus.REJECTED,
      },
    }),
  ]);

  const { documentMeta, user: documentOwner } = document;

  const isEmailEnabled = extractDerivedDocumentEmailSettings(
    document.documentMeta,
  ).recipientSigningRequest;

  if (!isEmailEnabled) {
    return;
  }

  const { branding, settings } = await getEmailContext({
    source: {
      type: 'team',
      teamId: document.teamId,
    },
  });

  const lang = documentMeta?.language ?? settings.documentLanguage;

  const i18n = await getI18nInstance(lang);

  // Send confirmation email to the recipient who rejected
  await io.runTask('send-rejection-confirmation-email', async () => {
    const recipientTemplate = createElement(DocumentRejectionConfirmedEmail, {
      recipientName: recipient.name,
      documentName: document.title,
      documentOwnerName: document.user.name || document.user.email,
      reason: recipient.rejectionReason || '',
      assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    });

    const [html, text] = await Promise.all([
      renderEmailWithI18N(recipientTemplate, { lang, branding }),
      renderEmailWithI18N(recipientTemplate, {
        lang,
        branding,
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
      subject: i18n._(msg`Document "${document.title}" - Rejection Confirmed`),
      html,
      text,
    });
  });

  // Send notification email to document owner
  await io.runTask('send-owner-notification-email', async () => {
    const ownerTemplate = createElement(DocumentRejectedEmail, {
      recipientName: recipient.name,
      documentName: document.title,
      documentUrl: `${NEXT_PUBLIC_WEBAPP_URL()}${formatDocumentsPath(document.team?.url)}/${
        document.id
      }`,
      rejectionReason: recipient.rejectionReason || '',
      assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    });

    const [html, text] = await Promise.all([
      renderEmailWithI18N(ownerTemplate, { lang, branding }),
      renderEmailWithI18N(ownerTemplate, {
        lang,
        branding,
        plainText: true,
      }),
    ]);

    await mailer.sendMail({
      to: {
        name: documentOwner.name || '',
        address: documentOwner.email,
      },
      from: {
        name: FROM_NAME,
        address: FROM_ADDRESS,
      },
      subject: i18n._(msg`Document "${document.title}" - Rejected by ${recipient.name}`),
      html,
      text,
    });
  });

  await io.runTask('update-recipient', async () => {
    await prisma.recipient.update({
      where: {
        id: recipient.id,
      },
      data: {
        sendStatus: SendStatus.SENT,
      },
    });
  });
};
