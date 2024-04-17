<<<<<<< HEAD
=======
import type { Metadata } from 'next';
>>>>>>> main
import Link from 'next/link';

import { Button } from '@documenso/ui/primitives/button';

<<<<<<< HEAD
export default function ResetPasswordPage() {
  return (
    <div>
      <h1 className="text-4xl font-semibold">Unable to reset password</h1>

      <p className="text-muted-foreground mt-2 text-sm">
        The token you have used to reset your password is either expired or it never existed. If you
        have still forgotten your password, please request a new reset link.
      </p>

      <Button className="mt-4" asChild>
        <Link href="/signin">Return to sign in</Link>
      </Button>
=======
export const metadata: Metadata = {
  title: 'Reset Password',
};

export default function ResetPasswordPage() {
  return (
    <div className="w-screen max-w-lg px-4">
      <div className="w-full">
        <h1 className="text-3xl font-semibold">Unable to reset password</h1>

        <p className="text-muted-foreground mt-2 text-sm">
          The token you have used to reset your password is either expired or it never existed. If
          you have still forgotten your password, please request a new reset link.
        </p>

        <Button className="mt-4" asChild>
          <Link href="/signin">Return to sign in</Link>
        </Button>
      </div>
>>>>>>> main
    </div>
  );
}
