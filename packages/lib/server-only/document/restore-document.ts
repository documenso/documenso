'use server';

import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import DocumentRestoreTemplate from '@documenso/email/templates/document-restore';
import { prisma } from '@documenso/prisma';
import type { Document, DocumentMeta, Recipient, User } from '@documenso/prisma/client';
import { DocumentStatus } from '@documenso/prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { FROM_ADDRESS, FROM_NAME } from '../../constants/email';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';

export type RestoreDocumentOptions = {
  id: number;
  userId: number;
  teamId?: number;
  requestMetadata?: RequestMetadata;
};

export const restoreDocument = async ({
  id,
  userId,
  teamId,
  requestMetadata,
}: RestoreDocumentOptions) => {
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

  // Handle restoring the actual document if user has permission.
  if (isUserOwner || isUserTeamMember) {
    await handleDocumentOwnerRestore({
      document,
      user,
      requestMetadata,
    });
  }

  // Continue to show the document to the user if they are a recipient.
  if (userRecipient?.documentDeletedAt !== null) {
    await prisma.recipient
      .update({
        where: {
          id: userRecipient?.id,
        },
        data: {
          documentDeletedAt: null,
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

type HandleDocumentOwnerRestoreOptions = {
  document: Document & {
    Recipient: Recipient[];
    documentMeta: DocumentMeta | null;
  };
  user: User;
  requestMetadata?: RequestMetadata;
};

const handleDocumentOwnerRestore = async ({
  document,
  user,
  requestMetadata,
}: HandleDocumentOwnerRestoreOptions) => {
  if (!document.deletedAt) {
    return;
  }

  // Restore soft-deleted documents.
  if (document.status === DocumentStatus.COMPLETED) {
    return await prisma.$transaction(async (tx) => {
      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          documentId: document.id,
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RESTORED,
          user,
          requestMetadata,
          data: {
            type: 'RESTORE',
          },
        }),
      });

      await tx.recipient.updateMany({
        where: {
          documentId: document.id,
        },
        data: {
          documentDeletedAt: null,
        },
      });

      return await tx.document.update({
        where: {
          id: document.id,
        },
        data: {
          deletedAt: null,
        },
      });
    });
  }

  // Restore draft and pending documents.
  const restoredDocument = await prisma.$transaction(async (tx) => {
    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        documentId: document.id,
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RESTORED,
        user,
        requestMetadata,
        data: {
          type: 'RESTORE',
        },
      }),
    });

    return await tx.document.update({
      where: {
        id: document.id,
      },
      data: {
        deletedAt: null,
      },
    });
  });

  // Send restoration emails to recipients.
  await Promise.all(
    document.Recipient.map(async (recipient) => {
      const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

      const template = createElement(DocumentRestoreTemplate, {
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
        subject: 'Document Restored',
        html: render(template),
        text: render(template, { plainText: true }),
      });
    }),
  );

  return restoredDocument;
};
