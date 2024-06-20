import { createElement } from 'react';

import { z } from 'zod';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import DocumentInviteEmailTemplate from '@documenso/email/templates/document-invite';
import { prisma } from '@documenso/prisma';
import {
  DocumentSource,
  DocumentStatus,
  RecipientRole,
  SendStatus,
} from '@documenso/prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { FROM_ADDRESS, FROM_NAME } from '../../constants/email';
import {
  RECIPIENT_ROLES_DESCRIPTION,
  RECIPIENT_ROLE_TO_EMAIL_TYPE,
} from '../../constants/recipient-roles';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { ZRequestMetadataSchema } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { renderCustomEmailTemplate } from '../../utils/render-custom-email-template';
import { type JobDefinition } from '../client/_internal/job';

const SEND_SIGNING_EMAIL_JOB_DEFINITION_ID = 'send.signing.requested.email';

const SEND_SIGNING_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  userId: z.number(),
  documentId: z.number(),
  recipientId: z.number(),
  requestMetadata: ZRequestMetadataSchema.optional(),
});

export const SEND_SIGNING_EMAIL_JOB_DEFINITION = {
  id: SEND_SIGNING_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Signing Email',
  version: '1.0.0',
  trigger: {
    name: SEND_SIGNING_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_SIGNING_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const { userId, documentId, recipientId, requestMetadata } = payload;

    const [user, document, recipient] = await Promise.all([
      prisma.user.findFirstOrThrow({
        where: {
          id: userId,
        },
      }),
      prisma.document.findFirstOrThrow({
        where: {
          id: documentId,
          status: DocumentStatus.PENDING,
        },
        include: {
          documentMeta: true,
        },
      }),
      prisma.recipient.findFirstOrThrow({
        where: {
          id: recipientId,
        },
      }),
    ]);

    const { documentMeta } = document;

    if (recipient.role === RecipientRole.CC) {
      return;
    }

    const customEmail = document?.documentMeta;
    const isDirectTemplate = document.source === DocumentSource.TEMPLATE_DIRECT_LINK;

    const recipientEmailType = RECIPIENT_ROLE_TO_EMAIL_TYPE[recipient.role];

    const { email, name } = recipient;
    const selfSigner = email === user.email;
    const { actionVerb } = RECIPIENT_ROLES_DESCRIPTION[recipient.role];
    const recipientActionVerb = actionVerb.toLowerCase();

    let emailMessage = customEmail?.message || '';
    let emailSubject = `Please ${recipientActionVerb} this document`;

    if (selfSigner) {
      emailMessage = `You have initiated the document ${`"${document.title}"`} that requires you to ${recipientActionVerb} it.`;
      emailSubject = `Please ${recipientActionVerb} your document`;
    }

    if (isDirectTemplate) {
      emailMessage = `A document was created by your direct template that requires you to ${recipientActionVerb} it.`;
      emailSubject = `Please ${recipientActionVerb} this document created by your direct template`;
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
      inviterEmail: user.email,
      assetBaseUrl,
      signDocumentLink,
      customBody: renderCustomEmailTemplate(emailMessage, customEmailTemplate),
      role: recipient.role,
      selfSigner,
    });

    await io.runTask('send-signing-email', async () => {
      await mailer.sendMail({
        to: {
          name: recipient.name,
          address: recipient.email,
        },
        from: {
          name: FROM_NAME,
          address: FROM_ADDRESS,
        },
        subject: renderCustomEmailTemplate(
          documentMeta?.subject || emailSubject,
          customEmailTemplate,
        ),
        html: render(template),
        text: render(template, { plainText: true }),
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

    await io.runTask('store-audit-log', async () => {
      await prisma.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
          documentId: document.id,
          user,
          requestMetadata,
          data: {
            emailType: recipientEmailType,
            recipientId: recipient.id,
            recipientName: recipient.name,
            recipientEmail: recipient.email,
            recipientRole: recipient.role,
            isResending: false,
          },
        }),
      });
    });
  },
} as const satisfies JobDefinition<
  typeof SEND_SIGNING_EMAIL_JOB_DEFINITION_ID,
  z.infer<typeof SEND_SIGNING_EMAIL_JOB_DEFINITION_SCHEMA>
>;
