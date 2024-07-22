'use server';

import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import DocumentCancelTemplate from '@documenso/email/templates/document-cancel';
import { prisma } from '@documenso/prisma';
import type { Document, DocumentMeta, Recipient, User } from '@documenso/prisma/client';
import { DocumentStatus, SendStatus } from '@documenso/prisma/client';

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
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const document = await prisma.document.findUnique({
    where: {
      id,
    },
    include: {
      Recipient: true,
      documentMeta: true,
      team: {
        select: {
          members: true,
        },
      },
    },
  });

  if (!document || (teamId !== undefined && teamId !== document.teamId)) {
    throw new Error('Document not found');
  }

  const isUserOwner = document.userId === userId;
  const isUserTeamMember = document.team?.members.some((member) => member.userId === userId);
  const userRecipient = document.Recipient.find((recipient) => recipient.email === user.email);

  if (!isUserOwner && !isUserTeamMember && !userRecipient) {
    throw new Error('Not allowed');
  }

  // Handle hard or soft deleting the actual document if user has permission.
  if (isUserOwner || isUserTeamMember) {
    await handleDocumentOwnerDelete({
      document,
      user,
      requestMetadata,
    });
  }

  // Continue to hide the document from the user if they are a recipient.
  // Dirty way of doing this but it's faster than refetching the document.
  if (userRecipient?.documentDeletedAt === null) {
    await prisma.recipient
      .update({
        where: {
          id: userRecipient.id,
        },
        data: {
          documentDeletedAt: new Date().toISOString(),
        },
      })
      .catch(() => {
        // Do nothing.
      });
  }

  // Return partial document for API v1 response.
  return {
    id: document.id,
    userId: document.userId,
    teamId: document.teamId,
    title: document.title,
    status: document.status,
    documentDataId: document.documentDataId,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    completedAt: document.completedAt,
  };
};

type HandleDocumentOwnerDeleteOptions = {
  document: Document & {
    Recipient: Recipient[];
    documentMeta: DocumentMeta | null;
  };
  user: User;
  requestMetadata?: RequestMetadata;
};

const handleDocumentOwnerDelete = async ({
  document,
  user,
  requestMetadata,
}: HandleDocumentOwnerDeleteOptions) => {
  if (document.deletedAt) {
    return;
  }

  // Soft delete completed documents.
  if (document.status === DocumentStatus.COMPLETED) {
    return await prisma.$transaction(async (tx) => {
      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          documentId: document.id,
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
          id: document.id,
        },
        data: {
          deletedAt: new Date().toISOString(),
        },
      });
    });
  }

  // Hard delete draft and pending documents.
  const deletedDocument = await prisma.$transaction(async (tx) => {
    // Currently redundant since deleting a document will delete the audit logs.
    // However may be useful if we disassociate audit logs and documents if required.
    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        documentId: document.id,
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED,
        user,
        requestMetadata,
        data: {
          type: 'HARD',
        },
      }),
    });

    return await tx.document.delete({
      where: {
        id: document.id,
        status: {
          not: DocumentStatus.COMPLETED,
        },
      },
    });
  });

  // Send cancellation emails to recipients.
  await Promise.all(
    document.Recipient.map(async (recipient) => {
      if (recipient.sendStatus !== SendStatus.SENT) {
        return;
      }

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

  return deletedDocument;
};
