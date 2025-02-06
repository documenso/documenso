import { getContext } from 'hono/context-storage';
import { redirect } from 'react-router';
import type { HonoEnv } from 'server';

import type { AppSession } from '@documenso/lib/client-only/providers/session';

/**
 * Returns the session context or throws a redirect to signin if it is not present.
 */
export const getLoaderSession = (): AppSession => {
  const session = getOptionalLoaderSession();

  if (!session) {
    throw redirect('/signin'); // Todo: Maybe add a redirect cookie to come back?
  }

  return session;
};

export const getOptionalLoaderSession = (): AppSession | null => {
  const { context } = getContext<HonoEnv>().var;
  return context.session;
};

/**
 * Returns the team session context or throws a redirect to signin if it is not present.
 */
export const getLoaderTeamSession = () => {
  const session = getOptionalLoaderSession();

  if (!session) {
    throw redirect('/signin'); // Todo: Maybe add a redirect cookie to come back?
  }

  if (!session.currentTeam) {
    throw new Response(null, { status: 404 }); // Todo: Test that 404 page shows up.
  }

  return {
    ...session,
    currentTeam: session.currentTeam,
  };
};
