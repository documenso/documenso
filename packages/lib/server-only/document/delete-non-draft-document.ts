'use server';

import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import DocumentCancelTemplate from '@documenso/email/templates/document-cancel';
import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';

import { FROM_ADDRESS, FROM_NAME } from '../../constants/email';
import { renderCustomEmailTemplate } from '../../utils/render-custom-email-template';

export type DeleteNonDraftDocumentOptions = {
  id: number;
  userId: number;
  status: DocumentStatus;
};

export const deleteNonDraftDocument = async ({
  id,
  userId,
  status,
}: DeleteNonDraftDocumentOptions) => {
  // if the document is pending, send cancellation emails to all recipients
  if (status === DocumentStatus.PENDING) {
    const user = await prisma.user.findFirstOrThrow({
      where: {
        id: userId,
      },
    });

    const document = await prisma.document.findUnique({
      where: {
        id: id,
        userId,
      },
      include: {
        Recipient: true,
        documentMeta: true,
      },
    });

    const customEmail = document?.documentMeta;

    if (!document) {
      throw new Error('Document not found');
    }

    if (document.Recipient.length === 0) {
      throw new Error('Document has no recipients');
    }

    await Promise.all(
      document.Recipient.map(async (recipient) => {
        const { email, name } = recipient;

        const customEmailTemplate = {
          'signer.name': name,
          'signer.email': email,
          'document.name': document.title,
        };

        const assetBaseUrl = process.env.NEXT_PUBLIC_WEBAPP_URL || 'http://localhost:3000';
        const signDocumentLink = `${process.env.NEXT_PUBLIC_WEBAPP_URL}/sign/${recipient.token}`;

        const template = createElement(DocumentCancelTemplate, {
          documentName: document.title,
          inviterName: user.name || undefined,
          inviterEmail: user.email,
          assetBaseUrl,
          signDocumentLink,
          customBody: renderCustomEmailTemplate(customEmail?.message || '', customEmailTemplate),
        });

        await mailer.sendMail({
          to: {
            address: email,
            name,
          },
          from: {
            name: FROM_NAME,
            address: FROM_ADDRESS,
          },
          subject: customEmail?.subject
            ? renderCustomEmailTemplate(customEmail.subject, customEmailTemplate)
            : 'Please sign this document',
          html: render(template),
          text: render(template, { plainText: true }),
        });
      }),
    );
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
