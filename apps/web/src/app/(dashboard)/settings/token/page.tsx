import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';

import { ApiTokenForm } from '~/components/forms/token';

export default async function ApiToken() {
  const { user } = await getRequiredServerComponentSession();

  return (
    <div>
      <h3 className="text-lg font-medium">API Token</h3>

      <p className="text-muted-foreground mt-2 text-sm">
        On this page, you can create new API tokens and manage the existing ones.
      </p>

      <hr className="my-4" />

      <ApiTokenForm user={user} className="max-w-xl" />
    </div>
  );
}
