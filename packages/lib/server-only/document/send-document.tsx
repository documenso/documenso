import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { DocumentInviteEmailTemplate } from '@documenso/email/templates/document-invite';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, SendStatus } from '@documenso/prisma/client';

export interface SendDocumentOptions {
  documentId: number;
  userId: number;
}

export const sendDocument = async ({ documentId, userId }: SendDocumentOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const document = await prisma.document.findUnique({
    where: {
      id: documentId,
      userId,
    },
    include: {
      Recipient: true,
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.Recipient.length === 0) {
    throw new Error('Document has no recipients');
  }

  if (document.status === DocumentStatus.COMPLETED) {
    throw new Error('Can not send completed document');
  }

  await Promise.all([
    document.Recipient.map(async (recipient) => {
      const { email, name } = recipient;

      if (recipient.sendStatus === SendStatus.SENT) {
        return;
      }

      const assetBaseUrl = process.env.NEXT_PUBLIC_WEBAPP_URL || 'http://localhost:3000';
      const signDocumentLink = `${process.env.NEXT_PUBLIC_WEBAPP_URL}/sign/${recipient.token}`;

      const template = createElement(DocumentInviteEmailTemplate, {
        documentName: document.title,
        inviterName: user.name || undefined,
        inviterEmail: user.email,
        assetBaseUrl,
        signDocumentLink,
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
        subject: 'Please sign this document',
        html: render(template),
        text: render(template, { plainText: true }),
      });

      await prisma.recipient.update({
        where: {
          id: recipient.id,
        },
        data: {
          sendStatus: SendStatus.SENT,
        },
      });
    }),
  ]);

  const updatedDocument = await prisma.document.update({
    where: {
      id: documentId,
    },
    data: {
      status: DocumentStatus.PENDING,
    },
  });

  return updatedDocument;
};
