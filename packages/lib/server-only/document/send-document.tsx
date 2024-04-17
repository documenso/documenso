import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
<<<<<<< HEAD
import {
  SelfSignInvitationMessage,
  SelfSignInvitationSubject,
} from '@documenso/email/self-sign-email';
import { DocumentInviteEmailTemplate } from '@documenso/email/templates/document-invite';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import { renderCustomEmailTemplate } from '@documenso/lib/utils/render-custom-email-template';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, SendStatus } from '@documenso/prisma/client';
=======
import { DocumentInviteEmailTemplate } from '@documenso/email/templates/document-invite';
import { FROM_ADDRESS, FROM_NAME } from '@documenso/lib/constants/email';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { renderCustomEmailTemplate } from '@documenso/lib/utils/render-custom-email-template';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, RecipientRole, SendStatus } from '@documenso/prisma/client';
import { WebhookTriggerEvents } from '@documenso/prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import {
  RECIPIENT_ROLES_DESCRIPTION,
  RECIPIENT_ROLE_TO_EMAIL_TYPE,
} from '../../constants/recipient-roles';
import { getFile } from '../../universal/upload/get-file';
import { putFile } from '../../universal/upload/put-file';
import { insertFormValuesInPdf } from '../pdf/insert-form-values-in-pdf';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';
>>>>>>> main

export type SendDocumentOptions = {
  documentId: number;
  userId: number;
<<<<<<< HEAD
};

export const sendDocument = async ({ documentId, userId }: SendDocumentOptions) => {
=======
  teamId?: number;
  requestMetadata?: RequestMetadata;
};

export const sendDocument = async ({
  documentId,
  userId,
  teamId,
  requestMetadata,
}: SendDocumentOptions) => {
>>>>>>> main
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
<<<<<<< HEAD
=======
    select: {
      id: true,
      name: true,
      email: true,
    },
>>>>>>> main
  });

  const document = await prisma.document.findUnique({
    where: {
      id: documentId,
<<<<<<< HEAD
      userId,
=======
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
>>>>>>> main
    },
    include: {
      Recipient: true,
      documentMeta: true,
<<<<<<< HEAD
=======
      documentData: true,
>>>>>>> main
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

<<<<<<< HEAD
  await Promise.all([
    document.Recipient.map(async (recipient) => {
      const { email, name } = recipient;
      let SelfRecipient: boolean = false;
=======
  const { documentData } = document;

  if (!documentData.data) {
    throw new Error('Document data not found');
  }

  if (document.formValues) {
    const file = await getFile(documentData);

    const prefilled = await insertFormValuesInPdf({
      pdf: Buffer.from(file),
      formValues: document.formValues as Record<string, string | number | boolean>,
    });

    const newDocumentData = await putFile({
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

  await Promise.all(
    document.Recipient.map(async (recipient) => {
      if (recipient.sendStatus === SendStatus.SENT || recipient.role === RecipientRole.CC) {
        return;
      }

      const recipientEmailType = RECIPIENT_ROLE_TO_EMAIL_TYPE[recipient.role];

      const { email, name } = recipient;
>>>>>>> main

      const customEmailTemplate = {
        'signer.name': name,
        'signer.email': email,
        'document.name': document.title,
      };

<<<<<<< HEAD
      if (recipient.sendStatus === SendStatus.SENT) {
        return;
      }

      if (recipient.email === user.email && recipient.name === user.name) {
        SelfRecipient = true;
      }

      const assetBaseUrl = process.env.NEXT_PUBLIC_WEBAPP_URL || 'http://localhost:3000';
      const signDocumentLink = `${process.env.NEXT_PUBLIC_WEBAPP_URL}/sign/${recipient.token}`;
=======
      const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';
      const signDocumentLink = `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`;
>>>>>>> main

      const template = createElement(DocumentInviteEmailTemplate, {
        documentName: document.title,
        inviterName: user.name || undefined,
        inviterEmail: user.email,
        assetBaseUrl,
        signDocumentLink,
<<<<<<< HEAD
        customBody: renderCustomEmailTemplate(
          SelfRecipient ? SelfSignInvitationMessage : customEmail?.message || '',
          customEmailTemplate,
        ),
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
          ? renderCustomEmailTemplate(
              SelfRecipient ? SelfSignInvitationSubject : customEmail.subject,
              customEmailTemplate,
            )
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

  const updatedDocument = await prisma.document.update({
    where: {
      id: documentId,
    },
    data: {
      status: DocumentStatus.PENDING,
    },
=======
        customBody: renderCustomEmailTemplate(customEmail?.message || '', customEmailTemplate),
        role: recipient.role,
      });

      const { actionVerb } = RECIPIENT_ROLES_DESCRIPTION[recipient.role];

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
        },
        { timeout: 30_000 },
      );
    }),
  );

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
>>>>>>> main
  });

  return updatedDocument;
};
