import Link from 'next/link';

import { Button } from '@documenso/ui/primitives/button';

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-4xl font-semibold">Email sent!</h1>

      <p className="text-muted-foreground mb-4 mt-2 text-sm">
        A password reset email has been sent, if you have an account you should see it in your inbox
        shortly.
      </p>

      <Button asChild>
        <Link href="/signin">Return to sign in</Link>
      </Button>
    </div>
  );
}
