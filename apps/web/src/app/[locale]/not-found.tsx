import Link from 'next/link';
import { useParams } from 'next/navigation';

import { getServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { useTranslation } from '@documenso/ui/i18n/client';
import { LocaleTypes } from '@documenso/ui/i18n/settings';
import { Button } from '@documenso/ui/primitives/button';

import NotFoundPartial from '~/components/partials/not-found';

export default async function NotFound() {
  const { session } = await getServerComponentSession();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const locale = useParams()?.locale as LocaleTypes;

  const { t } = useTranslation(locale, 'dashboard');
  return (
    <NotFoundPartial>
      {session && (
        <Button className="w-32" asChild>
          <Link href="/documents">{t(`documents`)}</Link>
        </Button>
      )}

      {!session && (
        <Button className="w-32" asChild>
          <Link href="/signin">{t(`sign-in`)}</Link>
        </Button>
      )}
    </NotFoundPartial>
  );
}
