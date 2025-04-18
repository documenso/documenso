/**
 * Stub implementation of the platform plan check.
 * In the stub version, all documents are considered to be on the platform plan.
 */
import type { Document, User } from '@documenso/prisma/client';

export const isDocumentPlatform = async (
  document?: Document | null | { userId: number; teamId?: number | null },
) => {
  return true;
};
