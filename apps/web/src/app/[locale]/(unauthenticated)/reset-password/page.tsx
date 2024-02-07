import type { Metadata } from 'next';
import Link from 'next/link';

import type { PageParams } from '@documenso/lib/types/page-params';
import { Button } from '@documenso/ui/primitives/button';

import initTranslations from '~/app/i18n';

export const metadata: Metadata = {
  title: 'Reset Password',
};

export default async function ResetPasswordPage({ params: { locale } }: PageParams) {
  const { t } = await initTranslations(locale);
  return (
    <div>
      <h1 className="text-4xl font-semibold">{t('unable_to_reset_password')}</h1>

      <p className="text-muted-foreground mt-2 text-sm">{t('please_request_a_new_reset_link')}</p>

      <Button className="mt-4" asChild>
        <Link href="/signin">{t('return_to_sign_in')}</Link>
      </Button>
    </div>
  );
}
