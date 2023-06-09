import Image from 'next/image';
import Link from 'next/link';

import backgroundPattern from '~/assets/background-pattern.png';
import connections from '~/assets/connections.png';
import { SignUpForm } from '~/components/forms/signup';

export default function SignUpPage() {
  return (
    <main className="bg-sand-100 relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12 md:p-12 lg:p-24">
      <div className="relative flex max-w-4xl items-center gap-x-24">
        <div className="absolute -inset-96 -z-[1] flex items-center justify-center opacity-50">
          <Image src={backgroundPattern} alt="background pattern" />
        </div>

        <div className="max-w-md">
          <h1 className="text-4xl font-semibold">Create a shiny, new Documenso Account ✨</h1>

          <p className="mt-2 text-sm text-slate-500">
            Create your account and start using state-of-the-art document signing. Open and
            beautiful signing is within your grasp.
          </p>

          <SignUpForm className="mt-4" />

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/signin" className="text-primary duration-200 hover:opacity-70">
              Sign in instead
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
