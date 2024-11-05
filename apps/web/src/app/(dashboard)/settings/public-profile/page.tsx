import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getUserPublicProfile } from '@documenso/lib/server-only/user/get-user-public-profile';

import { PublicProfilePageView } from './public-profile-page-view';

export default async function Page() {
  await setupI18nSSR();

  const { user } = await getRequiredServerComponentSession();

  const { profile } = await getUserPublicProfile({
    userId: user.id,
  });

  return <PublicProfilePageView user={user} profile={profile} />;
}
