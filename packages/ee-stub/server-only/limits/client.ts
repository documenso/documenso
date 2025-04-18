/**
 * Stub implementation of the limits client.
 * In the stub version, all users get community plan limits.
 */
import { COMMUNITY_PLAN_LIMITS } from './constants';

export type Limits = typeof COMMUNITY_PLAN_LIMITS;

export const getLimits = async ({
  headers,
}: { headers?: Record<string, string> } = {}): Promise<Limits> => {
  return COMMUNITY_PLAN_LIMITS;
};
