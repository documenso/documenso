import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { IS_GOOGLE_SSO_ENABLED } from '@documenso/lib/constants/auth';
import type { PageParams } from '@documenso/lib/types/page-params';

import initTranslations from '~/app/i18n';
import { SignUpForm } from '~/components/forms/signup';

export const metadata: Metadata = {
  title: 'Sign Up',
};

export default async function SignUpPage({ params: { locale } }: PageParams) {
  const { t } = await initTranslations(locale);
  if (process.env.NEXT_PUBLIC_DISABLE_SIGNUP === 'true') {
    redirect('/signin');
  }

  return (
    <div>
      <h1 className="text-4xl font-semibold">{t('create_new_account')}</h1>

      <p className="text-muted-foreground/60 mt-2 text-sm">{t('open_and_beautiful_signing')}</p>

      <SignUpForm className="mt-4" isGoogleSSOEnabled={IS_GOOGLE_SSO_ENABLED} />

      <p className="text-muted-foreground mt-6 text-center text-sm">
        {t('already_have_an_account')}{' '}
        <Link href="/signin" className="text-primary duration-200 hover:opacity-70">
          {t('sign_in_instead')}
        </Link>
      </p>
    </div>
  );
}
