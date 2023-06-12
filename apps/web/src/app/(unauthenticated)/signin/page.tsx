import Image from 'next/image';
import Link from 'next/link';

import backgroundPattern from '~/assets/background-pattern.png';
import connections from '~/assets/card-sharing-figure.png';
import { SignInForm } from '~/components/forms/signin';

export default function SignInPage() {
  return (
    <main className="bg-sand-100 relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12 md:p-12 lg:p-24">
      <div className="relative flex max-w-4xl items-center gap-x-24">
        <div className="absolute -inset-96 -z-[1] flex items-center justify-center opacity-50">
          <Image
            src={backgroundPattern}
            alt="background pattern"
            className="dark:brightness-95 dark:invert dark:sepia"
          />
        </div>

        <div className="max-w-md">
          <h1 className="text-4xl font-semibold">Sign in to your account</h1>

          <p className="text-muted-foreground/60 mt-2 text-sm">
            Welcome back, we are lucky to have you.
          </p>

          <SignInForm className="mt-4" />

          <p className="text-muted-foreground mt-6 text-center text-sm">
            Don't have an account?{' '}
            <Link href="/signup" className="text-primary duration-200 hover:opacity-70">
              Sign up
            </Link>
          </p>
        </div>

        <div className="hidden flex-1 lg:block">
          <Image src={connections} alt="documenso connections" />
        </div>
      </div>
    </main>
  );
}
