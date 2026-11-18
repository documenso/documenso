import type { ActionFunctionArgs } from 'react-router';
import { isWebappOrigin } from 'server/utils/is-webapp-origin';

import { userPreferencesCookie } from '~/storage/user-preferences-cookie.server';
import { parseUserPreferences, ZUserPreferencesSchema } from '~/utils/user-preferences';

/**
 * Merges the given preferences into the user preferences cookie.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  // A hono csrf middleware mount only matches the exact path, but React
  // Router also runs this action for variants like `/API/user-preferences` and
  // `/api/user-preferences/`.
  if (!isWebappOrigin(request.headers.get('origin'))) {
    throw new Response('Forbidden', { status: 403 });
  }

  const update = ZUserPreferencesSchema.safeParse(await request.json().catch(() => null));

  if (!update.success) {
    throw new Response('Invalid preferences', { status: 400 });
  }

  // Merged into the cookie sent with this request, so a client only overwrites the
  // fields it sends.
  const currentPreferences = parseUserPreferences(await userPreferencesCookie.parse(request.headers.get('cookie')));

  return new Response('OK', {
    status: 200,
    headers: {
      'Set-Cookie': await userPreferencesCookie.serialize({ ...currentPreferences, ...update.data }),
    },
  });
};
