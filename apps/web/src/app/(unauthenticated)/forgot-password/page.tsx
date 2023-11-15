import Link from 'next/link';

import { ForgotPasswordForm } from '~/components/forms/forgot-password';

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-4xl font-semibold">Forgot your password?</h1>

      <p className="text-muted-foreground mt-2 text-sm">
        No worries, it happens! Enter your email and we'll email you a special link to reset your
        password.
      </p>

      <ForgotPasswordForm className="mt-4" />

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Remembered your password?{' '}
        <Link href="/signin" className="text-primary duration-200 hover:opacity-70">
          Sign In
        </Link>
      </p>
    </div>
  );
}
