import Link from 'next/link';

import { useTranslation } from '@documenso/ui/i18n/client';
import { LocaleTypes } from '@documenso/ui/i18n/settings';

import { SignUpForm } from '~/components/forms/signup';

export interface SignUpPageProps {
  locale: LocaleTypes;
}
const SignUpPage = ({ locale }: SignUpPageProps) => {
  const { t } = useTranslation(locale, 'dashboard');

  return (
    <div>
      <h1 className="text-4xl font-semibold">Create a new account</h1>

      <p className="text-muted-foreground/60 mt-2 text-sm">
        Create your account and start using state-of-the-art document signing. Open and beautiful
        signing is within your grasp.
      </p>

      <SignUpForm className="mt-4" />

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Already have an account?{' '}
        <Link href="/signin" className="text-primary duration-200 hover:opacity-70">
          Sign in instead
        </Link>
      </p>
    </div>
  );
};

export default SignUpPage;
