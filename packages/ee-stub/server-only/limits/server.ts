import { COMMUNITY_PLAN_LIMITS, TEAM_PLAN_LIMITS } from './constants';

/**
 * Stub implementation of the server-side limits.
 * In the stub version, all users get community plan limits.
 */
import type { User } from '@documenso/prisma/client';

export type ServerLimits = typeof COMMUNITY_PLAN_LIMITS & {
  remaining: {
    documents: number;
    recipients: number;
    directTemplates: number;
  };
};

export const getServerLimits = async (
  params?: { email?: string; teamId?: string | number | null } | User | null,
): Promise<ServerLimits> => {
  const teamId =
    typeof params === 'object' && params !== null ? 'teamId' in params && params.teamId : undefined;

  const limits = teamId ? TEAM_PLAN_LIMITS : COMMUNITY_PLAN_LIMITS;

  return {
    ...limits,
    remaining: {
      documents: limits.MAX_DOCUMENTS,
      recipients: limits.MAX_SIGNERS,
      directTemplates: limits.MAX_TEMPLATES,
    },
  };
};
