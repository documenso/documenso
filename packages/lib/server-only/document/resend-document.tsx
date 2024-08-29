import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { DocumentInviteEmailTemplate } from '@documenso/email/templates/document-invite';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import {
  RECIPIENT_ROLES_DESCRIPTION_ENG,
  RECIPIENT_ROLE_TO_EMAIL_TYPE,
} from '@documenso/lib/constants/recipient-roles';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { renderCustomEmailTemplate } from '@documenso/lib/utils/render-custom-email-template';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, RecipientRole, SigningStatus } from '@documenso/prisma/client';
import type { Prisma } from '@documenso/prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { getDocumentWhereInput } from './get-document-by-id';

export type ResendDocumentOptions = {
  documentId: number;
  userId: number;
  recipients: number[];
  teamId?: number;
  requestMetadata: RequestMetadata;
};

export const resendDocument = async ({
  documentId,
  userId,
  recipients,
  teamId,
  requestMetadata,
}: ResendDocumentOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const documentWhereInput: Prisma.DocumentWhereUniqueInput = await getDocumentWhereInput({
    documentId,
    userId,
    teamId,
  });

  const document = await prisma.document.findUnique({
    where: documentWhereInput,
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
      team: {
        select: {
          teamEmail: true,
          name: true,
        },
      },
    },
  });

  const customEmail = document?.documentMeta;
  const isTeamDocument = document?.team !== null;

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
      if (recipient.role === RecipientRole.CC) {
        return;
      }

      const recipientEmailType = RECIPIENT_ROLE_TO_EMAIL_TYPE[recipient.role];

      const { email, name } = recipient;
      const selfSigner = email === user.email;

      const recipientActionVerb =
        RECIPIENT_ROLES_DESCRIPTION_ENG[recipient.role].actionVerb.toLowerCase();

      let emailMessage = customEmail?.message || '';
      let emailSubject = `Reminder: Please ${recipientActionVerb} this document`;

      if (selfSigner) {
        emailMessage = `You have initiated the document ${`"${document.title}"`} that requires you to ${recipientActionVerb} it.`;
        emailSubject = `Reminder: Please ${recipientActionVerb} your document`;
      }

      if (isTeamDocument && document.team) {
        emailSubject = `Reminder: ${document.team.name} invited you to ${recipientActionVerb} a document`;
        emailMessage = `${user.name} on behalf of ${document.team.name} has invited you to ${recipientActionVerb} the document "${document.title}".`;
      }

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
        inviterEmail: isTeamDocument ? document.team?.teamEmail?.email || user.email : user.email,
        assetBaseUrl,
        signDocumentLink,
        customBody: renderCustomEmailTemplate(emailMessage, customEmailTemplate),
        role: recipient.role,
        selfSigner,
        isTeamInvite: isTeamDocument,
        teamName: document.team?.name,
      });

      await prisma.$transaction(
        async (tx) => {
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
              ? renderCustomEmailTemplate(`Reminder: ${customEmail.subject}`, customEmailTemplate)
              : emailSubject,
            html: render(template),
            text: render(template, { plainText: true }),
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
                isResending: true,
              },
            }),
          });
        },
        { timeout: 30_000 },
      );
    }),
  );
};
