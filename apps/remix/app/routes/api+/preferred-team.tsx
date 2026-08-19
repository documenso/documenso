import { PREFERRED_TEAM_URL_COOKIE } from '@documenso/lib/constants/cookies';
import { ZTeamUrlSchema } from '@documenso/trpc/server/team-router/schema';
import type { ActionFunctionArgs } from 'react-router';

/**
 * Sets the preferred team cookie.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const teamUrl = ZTeamUrlSchema.safeParse(formData.get('teamUrl'));

  if (!teamUrl.success) {
    throw new Response('Invalid team url', { status: 400 });
  }

  return new Response('OK', {
    status: 200,
    // Attributes must stay in step with the middleware: session cookie, root path, Lax.
    headers: { 'Set-Cookie': `${PREFERRED_TEAM_URL_COOKIE}=${teamUrl.data}; Path=/; SameSite=Lax` },
  });
};
