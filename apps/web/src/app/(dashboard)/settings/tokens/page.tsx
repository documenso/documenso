import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getUserTokens } from '@documenso/lib/server-only/public-api/get-all-user-tokens';

import { ApiTokenFormAndList } from '~/components/(dashboard)/settings/token/api-token-form-and-list';

export default async function ApiTokensPage() {
  const { user } = await getRequiredServerComponentSession();

  const tokens = await getUserTokens({ userId: user.id });

  return <ApiTokenFormAndList tokens={tokens} />;
}
