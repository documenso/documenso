/**
 * Stub implementation of the enterprise plan check.
 * In the stub version, no users are considered to be on the enterprise plan.
 */
import type { User } from '@documenso/prisma/client';

export const isUserEnterprise = async (
  user?: User | null | { userId: number; teamId?: number | null },
) => {
  return false;
};
