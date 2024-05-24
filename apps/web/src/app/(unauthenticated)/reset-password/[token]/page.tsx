import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getResetTokenValidity } from '@documenso/lib/server-only/user/get-reset-token-validity';

import { ResetPasswordForm } from '~/components/forms/reset-password';

type ResetPasswordPageProps = {
  params: {
    token: string;
  };
};

export default async function ResetPasswordPage({ params: { token } }: ResetPasswordPageProps) {
  const isValid = await getResetTokenValidity({ token });

  if (!isValid) {
    redirect('/reset-password');
  }

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="w-full">
        <h1 className="text-4xl font-semibold">Reset Password</h1>

        <p className="text-muted-foreground mt-2 text-sm">Please choose your new password </p>

        <ResetPasswordForm token={token} className="mt-4" />

        <p className="text-muted-foreground mt-6 text-center text-sm">
          Don't have an account?{' '}
          <Link href="/signup" className="text-primary duration-200 hover:opacity-70">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
