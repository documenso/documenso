import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { env } from 'next-runtime-env';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { IS_GOOGLE_SSO_ENABLED, IS_OIDC_SSO_ENABLED } from '@documenso/lib/constants/auth';

import { SignUpFormV2 } from '~/components/forms/v2/signup';

export const metadata: Metadata = {
  title: 'Sign Up',
};

export default async function SignUpPage() {
  await setupI18nSSR();

  const NEXT_PUBLIC_DISABLE_SIGNUP = env('NEXT_PUBLIC_DISABLE_SIGNUP');

  if (NEXT_PUBLIC_DISABLE_SIGNUP === 'true') {
    redirect('/signin');
  }

  return (
    <SignUpFormV2
      className="w-screen max-w-screen-2xl px-4 md:px-16 lg:-my-16"
      isGoogleSSOEnabled={IS_GOOGLE_SSO_ENABLED}
      isOIDCSSOEnabled={IS_OIDC_SSO_ENABLED}
    />
  );
}
