import type { AppLoadContext } from 'react-router';
import { redirect } from 'react-router';

/**
 * Returns the session context or throws a redirect to signin if it is not present.
 */
export const getRequiredSessionContext = (context: AppLoadContext) => {
  if (!context.session) {
    throw redirect('/signin'); // Todo: Maybe add a redirect cookie to come back?
  }

  return context.session;
};

/**
 * Returns the team session context or throws a redirect to signin if it is not present.
 */
export const getRequiredTeamSessionContext = (context: AppLoadContext) => {
  if (!context.session) {
    throw redirect('/signin'); // Todo: Maybe add a redirect cookie to come back?
  }

  if (!context.session.currentTeam) {
    throw new Response(null, { status: 404 }); // Todo: Test that 404 page shows up.
  }

  return {
    ...context.session,
    currentTeam: context.session.currentTeam,
  };
};
