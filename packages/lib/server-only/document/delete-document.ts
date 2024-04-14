'use server';

import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import DocumentCancelTemplate from '@documenso/email/templates/document-cancel';
import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { FROM_ADDRESS, FROM_NAME } from '../../constants/email';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';

export type DeleteDocumentOptions = {
  id: number;
  userId: number;
  teamId?: number;
  requestMetadata?: RequestMetadata;
};

export const deleteDocument = async ({
  id,
  userId,
  teamId,
  requestMetadata,
}: DeleteDocumentOptions) => {
  const document = await prisma.document.findUnique({
    where: {
      id,
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
      User: true,
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  const { status, User: user } = document;

  // if the document is a draft, hard-delete
  if (status === DocumentStatus.DRAFT) {
    return await prisma.$transaction(async (tx) => {
      // Currently redundant since deleting a document will delete the audit logs.
      // However may be useful if we disassociate audit lgos and documents if required.
      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          documentId: id,
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED,
          user,
          requestMetadata,
          data: {
            type: 'HARD',
          },
        }),
      });

      return await tx.document.delete({ where: { id, status: DocumentStatus.DRAFT } });
    });
  }

  // if the document is pending, send cancellation emails to all recipients
  if (status === DocumentStatus.PENDING && document.Recipient.length > 0) {
    await Promise.all(
      document.Recipient.map(async (recipient) => {
        const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

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

  // If the document is not a draft, only soft-delete.
  return await prisma.$transaction(async (tx) => {
    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        documentId: id,
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED,
        user,
        requestMetadata,
        data: {
          type: 'SOFT',
        },
      }),
    });

    return await tx.document.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date().toISOString(),
      },
    });
  });
};
