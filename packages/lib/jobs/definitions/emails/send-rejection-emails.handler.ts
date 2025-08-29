import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import { SendStatus, SigningStatus } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import DocumentRejectedEmail from '@documenso/email/templates/document-rejected';
import DocumentRejectionConfirmedEmail from '@documenso/email/templates/document-rejection-confirmed';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { DOCUMENSO_INTERNAL_EMAIL } from '../../../constants/email';
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
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
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

  const { user: documentOwner } = document;

  const isEmailEnabled = extractDerivedDocumentEmailSettings(
    document.documentMeta,
  ).recipientSigningRequest;

  if (!isEmailEnabled) {
    return;
  }

  const { branding, emailLanguage, senderEmail, replyToEmail } = await getEmailContext({
    emailType: 'RECIPIENT',
    source: {
      type: 'team',
      teamId: document.teamId,
    },
    meta: document.documentMeta,
  });

  const i18n = await getI18nInstance(emailLanguage);

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
      renderEmailWithI18N(recipientTemplate, { lang: emailLanguage, branding }),
      renderEmailWithI18N(recipientTemplate, {
        lang: emailLanguage,
        branding,
        plainText: true,
      }),
    ]);

    await mailer.sendMail({
      to: {
        name: recipient.name,
        address: recipient.email,
      },
      from: senderEmail,
      replyTo: replyToEmail,
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
      renderEmailWithI18N(ownerTemplate, { lang: emailLanguage, branding }),
      renderEmailWithI18N(ownerTemplate, {
        lang: emailLanguage,
        branding,
        plainText: true,
      }),
    ]);

    await mailer.sendMail({
      to: {
        name: documentOwner.name || '',
        address: documentOwner.email,
      },
      from: DOCUMENSO_INTERNAL_EMAIL, // Purposefully using internal email here.
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
