import Image from 'next/image';
import Link from 'next/link';

import backgroundPattern from '~/assets/background-pattern.png';
import { ResetPasswordForm } from '~/components/forms/reset-password';

export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  return (
    <main className="bg-sand-100 relative flex min-h-screen flex-col items-center justify-center overflow-hidden  px-4 py-12 md:p-12 lg:p-24">
      <div className="relative flex items-center gap-x-24 md:w-[500px]">
        <div className="absolute -inset-96 -z-[1] flex items-center justify-center opacity-50">
          <Image
            src={backgroundPattern}
            alt="background pattern"
            className="dark:brightness-95 dark:invert dark:sepia"
          />
        </div>

        <div className="w-full">
          <h1 className="text-4xl font-semibold">Reset Password</h1>

          <p className="text-muted-foreground/60 mt-2 text-sm">Please choose your new password </p>

          <ResetPasswordForm token={params.token} className="mt-4" />

          <p className="text-muted-foreground mt-6 text-center text-sm">
            Don't have an account?{' '}
            <Link href="/signup" className="text-primary duration-200 hover:opacity-70">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
