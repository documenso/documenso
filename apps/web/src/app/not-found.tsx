import Link from 'next/link';

import { Trans } from '@lingui/macro';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { Button } from '@documenso/ui/primitives/button';

import NotFoundPartial from '~/components/partials/not-found';

export default async function NotFound() {
  await setupI18nSSR();

  const { session } = await getServerComponentSession();

  return (
    <NotFoundPartial>
      {session && (
        <Button className="w-32" asChild>
          <Link href="/documents">
            <Trans>Documents</Trans>
          </Link>
        </Button>
      )}

      {!session && (
        <Button className="w-32" asChild>
          <Link href="/signin">
            <Trans>Sign In</Trans>
          </Link>
        </Button>
      )}
    </NotFoundPartial>
  );
}
