import { prisma } from '@documenso/prisma';

export interface GetDocumentAuditLogsByDocumentIdOptions {
  id: number;
}

export const getDocumentAuditLogsByDocumentId = async ({
  id,
}: GetDocumentAuditLogsByDocumentIdOptions) => {
  const document = await prisma.document.findUnique({ where: { id } });

  if (!document) {
    throw new Error('Document not found');
  }

  return await prisma.documentAuditLog.findMany({ where: { documentId: id } });
};
