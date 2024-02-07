import type { Metadata } from 'next';
import Link from 'next/link';

import { IS_GOOGLE_SSO_ENABLED } from '@documenso/lib/constants/auth';
import type { PageParams } from '@documenso/lib/types/page-params';

import initTranslations from '~/app/i18n';
import { SignInForm } from '~/components/forms/signin';

export const metadata: Metadata = {
  title: 'Sign In',
};

export default async function SignInPage({ params: { locale } }: PageParams) {
  const { t } = await initTranslations(locale);
  return (
    <div>
      <h1 className="text-4xl font-semibold">{t('sign_in_to_your_account')}</h1>

      <p className="text-muted-foreground/60 mt-2 text-sm">{t('welcome_back')}</p>

      <SignInForm className="mt-4" isGoogleSSOEnabled={IS_GOOGLE_SSO_ENABLED} />

      {process.env.NEXT_PUBLIC_DISABLE_SIGNUP !== 'true' && (
        <p className="text-muted-foreground mt-6 text-center text-sm">
          {t('dont_have_an_account')}{' '}
          <Link href="/signup" className="text-primary duration-200 hover:opacity-70">
            {t('sign_up')}
          </Link>
        </p>
      )}

      <p className="mt-2.5 text-center">
        <Link
          href="/forgot-password"
          className="text-muted-foreground text-sm duration-200 hover:opacity-70"
        >
          {t('forgot_password')}
        </Link>
      </p>
    </div>
  );
}
