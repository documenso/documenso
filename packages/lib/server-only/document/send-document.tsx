import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { DocumentInviteEmailTemplate } from '@documenso/email/templates/document-invite';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { renderCustomEmailTemplate } from '@documenso/lib/utils/render-custom-email-template';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, RecipientRole, SendStatus } from '@documenso/prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import {
  RECIPIENT_ROLES_DESCRIPTION,
  RECIPIENT_ROLE_TO_EMAIL_TYPE,
} from '../../constants/recipient-roles';

export type SendDocumentOptions = {
  documentId: number;
  userId: number;
  requestMetadata?: RequestMetadata;
};

export const sendDocument = async ({
  documentId,
  userId,
  requestMetadata,
}: SendDocumentOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  const document = await prisma.document.findUnique({
    where: {
      id: documentId,
      OR: [
        {
          userId,
        },
        {
          team: {
            members: {
              some: {
                userId,
              },
            },
          },
        },
      ],
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

  if (document.status === DocumentStatus.COMPLETED) {
    throw new Error('Can not send completed document');
  }

  await Promise.all(
    document.Recipient.map(async (recipient) => {
      if (recipient.sendStatus === SendStatus.SENT || recipient.role === RecipientRole.CC) {
        return;
      }

      const recipientEmailType = RECIPIENT_ROLE_TO_EMAIL_TYPE[recipient.role];

      const { email, name } = recipient;

      const customEmailTemplate = {
        'signer.name': name,
        'signer.email': email,
        'document.name': document.title,
      };

      const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';
      const signDocumentLink = `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`;

      const template = createElement(DocumentInviteEmailTemplate, {
        documentName: document.title,
        inviterName: user.name || undefined,
        inviterEmail: user.email,
        assetBaseUrl,
        signDocumentLink,
        customBody: renderCustomEmailTemplate(customEmail?.message || '', customEmailTemplate),
        role: recipient.role,
      });

      const { actionVerb } = RECIPIENT_ROLES_DESCRIPTION[recipient.role];

      await prisma.$transaction(async (tx) => {
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
            : `Please ${actionVerb.toLowerCase()} this document`,
          html: render(template),
          text: render(template, { plainText: true }),
        });

        await tx.recipient.update({
          where: {
            id: recipient.id,
          },
          data: {
            sendStatus: SendStatus.SENT,
          },
        });

        await tx.documentAuditLog.create({
          data: createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
            documentId: document.id,
            user,
            requestMetadata,
            data: {
              emailType: recipientEmailType,
              recipientEmail: recipient.email,
              recipientName: recipient.name,
              recipientRole: recipient.role,
              recipientId: recipient.id,
              isResending: false,
            },
          }),
        });
      });
    }),
  );

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
