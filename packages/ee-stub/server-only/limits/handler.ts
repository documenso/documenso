/**
 * Stub implementation of the limits API handler.
 * In the stub version, simply returns community plan limits.
 */
import { COMMUNITY_PLAN_LIMITS } from './constants';

export const limitsHandler = async (req: Request) => {
  return new Response(JSON.stringify(COMMUNITY_PLAN_LIMITS), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
