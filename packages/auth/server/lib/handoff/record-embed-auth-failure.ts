import { AUTH_HANDOFF_TYPE } from '@documenso/lib/constants/auth-handoff';
import { logger } from '@documenso/lib/utils/logger';
import type { Context } from 'hono';

import { clearEmbedAuthFlowCookie, getEmbedAuthFlowCookie } from '../session/session-cookies';
import { isEqualSecret } from '../utils/is-equal-secret';
import { createAuthHandoff } from './create-auth-handoff';

// Best effort; if the write fails the iframe still has Cancel and the flow timeout.
export const recordEmbedAuthFailure = async (nonce: string, reason: string): Promise<void> => {
  try {
    await createAuthHandoff({
      nonce,
      type: AUTH_HANDOFF_TYPE.EMBED_FAILED,
      payload: {},
    });
  } catch (err) {
    logger.error({
      event: 'auth.embed.failure_record_failed',
      reason,
      error: err,
    });
  }
};

/**
 * Without a `state` match nothing is recorded: a lingering flow cookie may
 * belong to a newer attempt, and failing it from an unrelated request would
 * break that attempt. Returns whether the request belonged to an embed flow.
 */
export const failEmbedAuthFlow = async (c: Context, state: string | undefined, reason: string): Promise<boolean> => {
  if (!state) {
    return false;
  }

  const flow = await getEmbedAuthFlowCookie(c);

  if (!flow || !isEqualSecret(flow.state, state)) {
    return false;
  }

  clearEmbedAuthFlowCookie(c);

  await recordEmbedAuthFailure(flow.nonce, reason);

  logger.warn({
    event: 'auth.embed.flow_failed',
    reason,
  });

  return true;
};
