import Link from 'next/link';

import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { Button } from '@documenso/ui/primitives/button';

import NotFoundPartial from '~/components/partials/not-found';

export default async function NotFound() {
  const { session } = await getServerComponentSession();

  return (
    <NotFoundPartial>
      {session && (
        <Button className="w-32" asChild>
          <Link href="/documents">Documents</Link>
        </Button>
      )}

      {!session && (
        <Button className="w-32" asChild>
          <Link href="/signin">Sign In</Link>
        </Button>
      )}
    </NotFoundPartial>
  );
}
