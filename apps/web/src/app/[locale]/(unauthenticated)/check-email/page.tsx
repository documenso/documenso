import type { Metadata } from 'next';
import Link from 'next/link';

import type { PageParams } from '@documenso/lib/types/page-params';
import { Button } from '@documenso/ui/primitives/button';

import initTranslations from '~/app/i18n';

export const metadata: Metadata = {
  title: 'Forgot password',
};

export default async function ForgotPasswordPage({ params: { locale } }: PageParams) {
  const { t } = await initTranslations(locale);
  return (
    <div>
      <h1 className="text-4xl font-semibold">{t('email_sent')}</h1>

      <p className="text-muted-foreground mb-4 mt-2 text-sm">{t('password_reset_email_sent')}</p>

      <Button asChild>
        <Link href="/signin">{t('return_to_sign_in')}</Link>
      </Button>
    </div>
  );
}
