import { getRequiredSession } from '@documenso/auth/server/lib/utils/get-session';
import { getUserPublicProfile } from '@documenso/lib/server-only/user/get-user-public-profile';

import { useAuth } from '~/providers/auth';

import type { Route } from './+types/index';
import { PublicProfilePageView } from './public-profile-page-view';

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getRequiredSession(request);

  const { profile } = await getUserPublicProfile({
    userId: user.id,
  });

  return { profile };
}

export default function PublicProfilePage({ loaderData }: Route.ComponentProps) {
  const { user } = useAuth();

  const { profile } = loaderData;

  return <PublicProfilePageView user={user} profile={profile} />;
}
