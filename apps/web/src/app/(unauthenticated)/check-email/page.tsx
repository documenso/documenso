import Image from 'next/image';
import Link from 'next/link';

import backgroundPattern from '~/assets/background-pattern.png';

export default function ForgotPasswordPage() {
  return (
    <main className="bg-sand-100 relative flex min-h-screen flex-col items-center justify-center overflow-hidden  px-4 py-12 md:p-12 lg:p-24">
      <div className="relative flex w-1/5 items-center gap-x-24">
        <div className="absolute -inset-96 -z-[1] flex items-center justify-center opacity-50">
          <Image
            src={backgroundPattern}
            alt="background pattern"
            className="dark:brightness-95 dark:invert dark:sepia"
          />
        </div>

        <div className="w-full text-center">
          <h1 className="text-4xl font-semibold">Reset Pasword</h1>

          <p className="text-muted-foreground/60 mb-4 mt-2 text-sm">
            Please check your email for reset instructions
          </p>

          <p className="text-muted-foreground mt-6 text-center text-sm">
            <Link href="/signin" className="text-primary duration-200 hover:opacity-70">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
