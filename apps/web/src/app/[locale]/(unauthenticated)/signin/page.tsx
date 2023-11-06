import Link from 'next/link';

import { createTranslation } from '@documenso/ui/i18n/server';

import { SignInForm } from '~/components/forms/signin';

const SignInPage = async ({ locale }) => {
  // Make sure to use the correct namespace here.
  const { t } = await createTranslation(locale, 'marketing');

  return (
    <div>
      <h1 className="text-4xl font-semibold">Sign in to your account</h1>

      <p className="text-muted-foreground/60 mt-2 text-sm">
        Welcome back, we are lucky to have you.
      </p>

      <SignInForm className="mt-4" />

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Don't have an account?{' '}
        <Link href="/signup" className="text-primary duration-200 hover:opacity-70">
          {t('signup')}
        </Link>
      </p>

      <p className="mt-2.5 text-center">
        <Link
          href="/forgot-password"
          className="text-muted-foreground text-sm duration-200 hover:opacity-70"
        >
          Forgot your password?
        </Link>
      </p>
    </div>
  );
};

export default SignInPage;
