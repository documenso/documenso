import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { DocumentInviteEmailTemplate } from '@documenso/email/templates/document-invite';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import { renderCustomEmailTemplate } from '@documenso/lib/utils/render-custom-email-template';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, SigningStatus } from '@documenso/prisma/client';

export type ResendDocumentOptions = {
  documentId: number;
  userId: number;
  recipients: number[];
};

export const resendDocument = async ({ documentId, userId, recipients }: ResendDocumentOptions) => {
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
      Recipient: {
        where: {
          id: {
            in: recipients,
          },
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      },
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

  if (document.status === DocumentStatus.DRAFT) {
    throw new Error('Can not send draft document');
  }

  if (document.status === DocumentStatus.COMPLETED) {
    throw new Error('Can not send completed document');
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

      const template = createElement(DocumentInviteEmailTemplate, {
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
};
