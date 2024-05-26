import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { DocumentInviteEmailTemplate } from '@documenso/email/templates/document-invite';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import { sealDocument } from '@documenso/lib/server-only/document/seal-document';
import { updateDocument } from '@documenso/lib/server-only/document/update-document';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { putPdfFile } from '@documenso/lib/universal/upload/put-file';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { renderCustomEmailTemplate } from '@documenso/lib/utils/render-custom-email-template';
import { prisma } from '@documenso/prisma';
import {
  DocumentSource,
  DocumentStatus,
  RecipientRole,
  SendStatus,
  SigningStatus,
} from '@documenso/prisma/client';
import { WebhookTriggerEvents } from '@documenso/prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import {
  RECIPIENT_ROLES_DESCRIPTION,
  RECIPIENT_ROLE_TO_EMAIL_TYPE,
} from '../../constants/recipient-roles';
import { getFile } from '../../universal/upload/get-file';
import { insertFormValuesInPdf } from '../pdf/insert-form-values-in-pdf';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type SendDocumentOptions = {
  documentId: number;
  userId: number;
  teamId?: number;
  sendEmail?: boolean;
  requestMetadata?: RequestMetadata;
};

export const sendDocument = async ({
  documentId,
  userId,
  teamId,
  sendEmail = true,
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
      ...(teamId
        ? {
            team: {
              id: teamId,
              members: {
                some: {
                  userId,
                },
              },
            },
          }
        : {
            userId,
            teamId: null,
          }),
    },
    include: {
      Recipient: true,
      documentMeta: true,
      documentData: true,
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

  const { documentData } = document;

  const isDirectTemplate = document.source === DocumentSource.TEMPLATE_DIRECT_LINK;

  if (!documentData.data) {
    throw new Error('Document data not found');
  }

  if (document.formValues) {
    const file = await getFile(documentData);

    const prefilled = await insertFormValuesInPdf({
      pdf: Buffer.from(file),
      formValues: document.formValues as Record<string, string | number | boolean>,
    });

    const newDocumentData = await putPdfFile({
      name: document.title,
      type: 'application/pdf',
      arrayBuffer: async () => Promise.resolve(prefilled),
    });

    const result = await prisma.document.update({
      where: {
        id: document.id,
      },
      data: {
        documentDataId: newDocumentData.id,
      },
    });

    Object.assign(document, result);
  }

  if (sendEmail) {
    await Promise.all(
      document.Recipient.map(async (recipient) => {
        if (recipient.sendStatus === SendStatus.SENT || recipient.role === RecipientRole.CC) {
          return;
        }

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
                ? renderCustomEmailTemplate(customEmail.subject, customEmailTemplate)
                : emailSubject,
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
          },
          { timeout: 30_000 },
        );
      }),
    );
  }

  const allRecipientsHaveNoActionToTake = document.Recipient.every(
    (recipient) =>
      recipient.role === RecipientRole.CC || recipient.signingStatus === SigningStatus.SIGNED,
  );

  if (allRecipientsHaveNoActionToTake) {
    const updatedDocument = await updateDocument({
      documentId,
      userId,
      teamId,
      data: { status: DocumentStatus.COMPLETED },
    });

    await sealDocument({ documentId: updatedDocument.id, requestMetadata });

    // Keep the return type the same for the `sendDocument` method
    return await prisma.document.findFirstOrThrow({
      where: {
        id: documentId,
      },
      include: {
        Recipient: true,
      },
    });
  }

  const updatedDocument = await prisma.$transaction(async (tx) => {
    if (document.status === DocumentStatus.DRAFT) {
      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT,
          documentId: document.id,
          requestMetadata,
          user,
          data: {},
        }),
      });
    }

    return await tx.document.update({
      where: {
        id: documentId,
      },
      data: {
        status: DocumentStatus.PENDING,
      },
      include: {
        Recipient: true,
      },
    });
  });

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_SENT,
    data: updatedDocument,
    userId,
    teamId,
  });

  return updatedDocument;
};
