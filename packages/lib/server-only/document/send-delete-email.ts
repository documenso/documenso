import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { DocumentDeletedEmailTemplate } from '@documenso/email/templates/document-deleted';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, SigningStatus } from '@documenso/prisma/client';

export interface SendDocumentOptions {
  documentId: number;
  userId: number;
}

export const sendDeletedEmail = async ({ documentId, userId }: SendDocumentOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });
  const document = await prisma.document.findUnique({
    where: {
      id: documentId,
    },
    include: {
      documentData: true,
      Recipient: true,
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.status == DocumentStatus.DRAFT) {
    throw new Error('Document is a draft state');
  }

  if (document.Recipient.length === 0) {
    throw new Error('Document has no recipients');
  }

  await Promise.all([
    document.Recipient.map(async (recipient) => {
      if (recipient.signingStatus !== SigningStatus.SIGNED) {
        const { email, name } = recipient;

        const assetBaseUrl = process.env.NEXT_PUBLIC_WEBAPP_URL || 'http://localhost:3000';

        const template = createElement(DocumentDeletedEmailTemplate, {
          inviterName: user.name || undefined,
          documentName: document.title,
          assetBaseUrl,
        });

        await mailer.sendMail({
          to: {
            address: email,
            name,
          },
          from: {
            name: process.env.NEXT_PRIVATE_SMTP_FROM_NAME || 'Documenso',
            address: process.env.NEXT_PRIVATE_SMTP_FROM_ADDRESS || 'noreply@documenso.com',
          },
          subject: 'Document Deleted | Signature Request Cancelled!',
          html: render(template),
          text: render(template, { plainText: true }),
        });
      }
    }),
  ]);
};
