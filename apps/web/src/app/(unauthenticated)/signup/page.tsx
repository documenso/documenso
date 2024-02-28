import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { env } from 'next-runtime-env';

import communityCardsImage from '@documenso/assets/images/community-cards.png';
import { IS_GOOGLE_SSO_ENABLED } from '@documenso/lib/constants/auth';
import { decryptSecondaryData } from '@documenso/lib/server-only/crypto/decrypt';

import { SignUpForm } from '~/components/forms/signup';
import { UserProfileSkeleton } from '~/components/ui/user-profile-skeleton';

export const metadata: Metadata = {
  title: 'Sign Up',
};

type SignUpPageProps = {
  searchParams: {
    email?: string;
  };
};

export default function SignUpPage({ searchParams }: SignUpPageProps) {
  const NEXT_PUBLIC_DISABLE_SIGNUP = env('NEXT_PUBLIC_DISABLE_SIGNUP');

  if (NEXT_PUBLIC_DISABLE_SIGNUP === 'true') {
    redirect('/signin');
  }

  const rawEmail = typeof searchParams.email === 'string' ? searchParams.email : undefined;
  const email = rawEmail ? decryptSecondaryData(rawEmail) : null;

  if (!email && rawEmail) {
    redirect('/signup');
  }

  return (
    <div className="flex w-screen max-w-screen-2xl justify-center gap-x-12 px-4 md:px-16">
      <div className="border-border relative hidden flex-1 overflow-hidden rounded-xl border xl:flex">
        <div className="absolute -inset-8 -z-[2] backdrop-blur">
          <Image
            src={communityCardsImage}
            fill={true}
            alt="community-cards"
            className="dark:brightness-95 dark:contrast-[70%] dark:invert"
          />
        </div>

        <div className="bg-background/50 absolute -inset-8 -z-[1] backdrop-blur-[2px]" />

        <div className="relative flex h-full w-full flex-col items-center justify-evenly">
          <div className="bg-background rounded-2xl border px-4 py-1 text-sm font-medium">
            User profiles are coming soon!
          </div>

          <UserProfileSkeleton
            user={{ name: 'Timur Ercan', email: 'timur@documenso.com', url: 'timur' }}
            rows={2}
            className="bg-background border-border w-full max-w-md rounded-2xl border shadow-md"
          />

          <div />
        </div>
      </div>

      <div className="border-border dark:bg-background z-10 max-w-lg rounded-xl border bg-neutral-100 p-6">
        <h1 className="text-2xl font-semibold">Create a new account</h1>

        <p className="text-muted-foreground mt-2 text-sm">
          Create your account and start using state-of-the-art document signing. Open and beautiful
          signing is within your grasp.
        </p>

        <hr className="-mx-6 my-4" />

        <SignUpForm
          className="mt-1"
          initialEmail={email || undefined}
          isGoogleSSOEnabled={IS_GOOGLE_SSO_ENABLED || true}
        />

        <p className="text-muted-foreground mt-6 text-center text-sm">
          Already have an account?{' '}
          <Link href="/signin" className="text-primary duration-200 hover:opacity-70">
            Sign in instead
          </Link>
        </p>
      </div>
    </div>
  );
}
