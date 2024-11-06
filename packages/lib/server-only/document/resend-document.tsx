import { createElement } from 'react';

import { msg } from '@lingui/macro';

import { mailer } from '@documenso/email/mailer';
import { DocumentInviteEmailTemplate } from '@documenso/email/templates/document-invite';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import {
  RECIPIENT_ROLES_DESCRIPTION,
  RECIPIENT_ROLE_TO_EMAIL_TYPE,
} from '@documenso/lib/constants/recipient-roles';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { renderCustomEmailTemplate } from '@documenso/lib/utils/render-custom-email-template';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, RecipientRole, SigningStatus } from '@documenso/prisma/client';
import type { Prisma } from '@documenso/prisma/client';

import { getI18nInstance } from '../../client-only/providers/i18n.server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
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

      const i18n = await getI18nInstance(document.documentMeta?.language);

      const recipientEmailType = RECIPIENT_ROLE_TO_EMAIL_TYPE[recipient.role];

      const { email, name } = recipient;
      const selfSigner = email === user.email;

      const recipientActionVerb = i18n
        ._(RECIPIENT_ROLES_DESCRIPTION[recipient.role].actionVerb)
        .toLowerCase();

      let emailMessage = customEmail?.message || '';
      let emailSubject = i18n._(msg`Reminder: Please ${recipientActionVerb} this document`);

      if (selfSigner) {
        emailMessage = i18n._(
          msg`You have initiated the document ${`"${document.title}"`} that requires you to ${recipientActionVerb} it.`,
        );
        emailSubject = i18n._(msg`Reminder: Please ${recipientActionVerb} your document`);
      }

      if (isTeamDocument && document.team) {
        emailSubject = i18n._(
          msg`Reminder: ${document.team.name} invited you to ${recipientActionVerb} a document`,
        );
        emailMessage =
          customEmail?.message ||
          i18n._(
            msg`${user.name} on behalf of ${document.team.name} has invited you to ${recipientActionVerb} the document "${document.title}".`,
          );
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
          const [html, text] = await Promise.all([
            renderEmailWithI18N(template, { lang: document.documentMeta?.language }),
            renderEmailWithI18N(template, {
              lang: document.documentMeta?.language,
              plainText: true,
            }),
          ]);

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
              ? renderCustomEmailTemplate(
                  i18n._(msg`Reminder: ${customEmail.subject}`),
                  customEmailTemplate,
                )
              : emailSubject,
            html,
            text,
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
