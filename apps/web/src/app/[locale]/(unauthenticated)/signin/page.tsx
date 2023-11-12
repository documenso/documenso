import Link from 'next/link';

import { LocaleTypes } from '@documenso/ui/i18n/settings';

import { SignInForm } from '~/components/forms/signin';

const SignInPage = ({ params: { locale } }: { params: { locale: LocaleTypes } }) => {
  // Make sure to use the correct namespace here.
  // eslint-disable-next-line prettier/prettier

  // const { t } = await createTranslation(locale, 'dashboard');
  return (
    <div>
      <h1 className="text-4xl font-semibold">Sign In to Your Account</h1>

      <p className="text-muted-foreground/60 mt-2 text-sm">Welcome Back</p>

      <SignInForm className="mt-4" />

      <p className="text-muted-foreground mt-6 text-center text-sm">
        No Account{' '}
        <Link href={`/${locale}/signup`} className="text-primary duration-200 hover:opacity-70">
          Sign Up
        </Link>
      </p>

      <p className="mt-2.5 text-center">
        <Link
          href={`/${locale}/forgot-password`}
          className="text-muted-foreground text-sm duration-200 hover:opacity-70"
        >
          Forgot Password
        </Link>
      </p>
    </div>
  );
};

export default SignInPage;
