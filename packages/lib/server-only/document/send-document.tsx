import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { DocumentInviteEmailTemplate } from '@documenso/email/templates/document-invite';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import { renderCustomEmailTemplate } from '@documenso/lib/utils/render-custom-email-template';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, SendStatus } from '@documenso/prisma/client';

import { upsertDocumentMeta } from '../document-meta/upsert-document-meta';

export type SendDocumentOptions = {
  documentId: number;
  userId: number;
};

type CustomEmail = {
  email?: {
    subject: string;
    message: string;
  };
};

export type resendDocumentOptions = {
  resendEmails: string[];
} & SendDocumentOptions &
  CustomEmail;

type getSendableDocumentOptions = {
  userId: number;
  documentId: number;
} & CustomEmail;

async function getSendableDocument({ documentId, userId, email }: getSendableDocumentOptions) {
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
      documentMeta: true,
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
  let customEmail = document?.documentMeta;

  if (email) {
    customEmail = await upsertDocumentMeta({
      documentId,
      message: email.message,
      subject: email.subject,
    });
  }

  return { document, user, customEmail };
}

type TGetSendableDocument = Awaited<ReturnType<typeof getSendableDocument>>;

type SendDocumentsOptions = {
  resendEmails?: string[];
} & TGetSendableDocument;

async function mailDocuments({ customEmail, document, resendEmails, user }: SendDocumentsOptions) {
  await Promise.all([
    document.Recipient.map(async (recipient) => {
      const { email, name } = recipient;

      const customEmailTemplate = {
        'signer.name': name,
        'signer.email': email,
        'document.name': document.title,
      };

      // If the email has been sent and we don't want to resend emails, skip it
      if (recipient.sendStatus === SendStatus.SENT && !resendEmails) {
        return;
      }

      // If we're resending emails and this email is not in the list, skip it
      if (resendEmails && !resendEmails.includes(email)) {
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
}

async function setDocumentPending(documentId: number) {
  const updatedDocument = await prisma.document.update({
    where: {
      id: documentId,
    },
    data: {
      status: DocumentStatus.PENDING,
    },
  });

  return updatedDocument;
}

export const resendDocument = async ({
  documentId,
  userId,
  resendEmails,
  email,
}: resendDocumentOptions) => {
  const { document, user, customEmail } = await getSendableDocument({ userId, documentId, email });

  await mailDocuments({ document, user, customEmail, resendEmails });

  return await setDocumentPending(documentId);
};

export const sendDocument = async ({ documentId, userId }: SendDocumentOptions) => {
  const { document, user, customEmail } = await getSendableDocument({ userId, documentId });

  await mailDocuments({ document, user, customEmail });

  return await setDocumentPending(documentId);
};
