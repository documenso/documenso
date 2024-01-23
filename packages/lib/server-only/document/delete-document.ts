'use server';

import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import DocumentCancelTemplate from '@documenso/email/templates/document-cancel';
import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';

import { FROM_ADDRESS, FROM_NAME } from '../../constants/email';

export type DeleteDocumentOptions = {
  id: number;
  userId: number;
  status: DocumentStatus;
};

export const deleteDocument = async ({ id, userId, status }: DeleteDocumentOptions) => {
  // if the document is a draft, hard-delete
  if (status === DocumentStatus.DRAFT) {
    return await prisma.document.delete({ where: { id, userId, status: DocumentStatus.DRAFT } });
  }

  // if the document is pending, send cancellation emails to all recipients
  if (status === DocumentStatus.PENDING) {
    const user = await prisma.user.findFirstOrThrow({
      where: {
        id: userId,
      },
    });

    const document = await prisma.document.findUnique({
      where: {
        id,
        status,
        userId,
      },
      include: {
        Recipient: true,
        documentMeta: true,
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    if (document.Recipient.length > 0) {
      await Promise.all(
        document.Recipient.map(async (recipient) => {
          const assetBaseUrl = process.env.NEXT_PUBLIC_WEBAPP_URL || 'http://localhost:3000';

          const template = createElement(DocumentCancelTemplate, {
            documentName: document.title,
            inviterName: user.name || undefined,
            inviterEmail: user.email,
            assetBaseUrl,
          });

          await mailer.sendMail({
            to: {
              address: recipient.email,
              name: recipient.name,
            },
            from: {
              name: FROM_NAME,
              address: FROM_ADDRESS,
            },
            subject: 'Document Cancelled',
            html: render(template),
            text: render(template, { plainText: true }),
          });
        }),
      );
    }
  }

  // If the document is not a draft, only soft-delete.
  return await prisma.document.update({
    where: {
      id,
    },
    data: {
      deletedAt: new Date().toISOString(),
    },
  });
};
