import type { Metadata } from 'next';
import Link from 'next/link';

import type { PageParams } from '@documenso/lib/types/page-params';

import initTranslations from '~/app/i18n';
import { ForgotPasswordForm } from '~/components/forms/forgot-password';

export const metadata: Metadata = {
  title: 'Forgot Password',
};

export default async function ForgotPasswordPage({ params: { locale } }: PageParams) {
  const { t } = await initTranslations(locale);
  return (
    <div>
      <h1 className="text-4xl font-semibold">{t('forgot_password')}</h1>

      <p className="text-muted-foreground mt-2 text-sm">{t('enter_email_reset_password')}</p>

      <ForgotPasswordForm className="mt-4" />

      <p className="text-muted-foreground mt-6 text-center text-sm">
        {t('remembered_password')}{' '}
        <Link href="/signin" className="text-primary duration-200 hover:opacity-70">
          {t('sign_in')}
        </Link>
      </p>
    </div>
  );
}
