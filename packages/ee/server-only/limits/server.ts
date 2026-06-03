// ABOUTME: Server-side limits resolver for the self-hosted PSD401 deployment.
// ABOUTME: Billing is stripped; all requests return SELFHOSTED_PLAN_LIMITS unconditionally.
import { SELFHOSTED_PLAN_LIMITS } from './constants';
import type { TLimitsResponseSchema } from './schema';

export type GetServerLimitsOptions = {
  userId: number;
  teamId: number;
};

export const getServerLimits = async (
  _options: GetServerLimitsOptions,
): Promise<TLimitsResponseSchema> => {
  return Promise.resolve({
    quota: SELFHOSTED_PLAN_LIMITS,
    remaining: SELFHOSTED_PLAN_LIMITS,
    maximumEnvelopeItemCount: Number.MAX_SAFE_INTEGER,
  });
};
