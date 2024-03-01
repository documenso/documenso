import Link from 'next/link';

import { AlertTriangle, CheckCircle2, XCircle, XOctagon } from 'lucide-react';

import { verifyEmail } from '@documenso/lib/server-only/user/verify-email';
import { Button } from '@documenso/ui/primitives/button';

export type PageProps = {
  params: {
    token: string;
  };
};

export default async function VerifyEmailPage({ params: { token } }: PageProps) {
  if (!token) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="w-full">
          <div className="mb-4 text-red-300">
            <XOctagon />
          </div>

          <h2 className="text-4xl font-semibold">No token provided</h2>
          <p className="text-muted-foreground mt-2 text-base">
            It seems that there is no token provided. Please check your email and try again.
          </p>
        </div>
      </div>
    );
  }

  const verified = await verifyEmail({ token });

  if (verified === null) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="flex w-full items-start">
          <div className="mr-4 mt-1 hidden md:block">
            <AlertTriangle className="h-10 w-10 text-yellow-500" strokeWidth={2} />
          </div>

          <div>
            <h2 className="text-2xl font-bold md:text-4xl">Something went wrong</h2>

            <p className="text-muted-foreground mt-4">
              We were unable to verify your email. If your email is not verified already, please try
              again.
            </p>

            <Button className="mt-4" asChild>
              <Link href="/">Go back home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="flex w-full items-start">
          <div className="mr-4 mt-1 hidden md:block">
            <XCircle className="text-destructive h-10 w-10" strokeWidth={2} />
          </div>

          <div>
            <h2 className="text-2xl font-bold md:text-4xl">Your token has expired!</h2>

            <p className="text-muted-foreground mt-4">
              It seems that the provided token has expired. We've just sent you another token,
              please check your email and try again.
            </p>

            <Button className="mt-4" asChild>
              <Link href="/">Go back home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="flex w-full items-start">
        <div className="mr-4 mt-1 hidden md:block">
          <CheckCircle2 className="h-10 w-10 text-green-500" strokeWidth={2} />
        </div>

        <div>
          <h2 className="text-2xl font-bold md:text-4xl">Email Confirmed!</h2>

          <p className="text-muted-foreground mt-4">
            Your email has been successfully confirmed! You can now use all features of Documenso.
          </p>

          <Button className="mt-4" asChild>
            <Link href="/">Go back home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
