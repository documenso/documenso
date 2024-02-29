'use client';

import { useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import communityCardsImage from '@documenso/assets/images/community-cards.png';
import { Stepper } from '@documenso/ui/primitives/stepper';

import { SignUpFormV2 } from '~/components/forms/v2/signup';
import { UserProfileTimur } from '~/components/ui/user-profile-timur';

type SignUpPageViewProps = {
  email?: string;
  isGoogleSSOEnabled?: boolean;
};

export const SignUpPageView = ({ email, isGoogleSSOEnabled }: SignUpPageViewProps) => {
  const [step, setStep] = useState(1);

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

          {
            <UserProfileTimur
              rows={2}
              className="bg-background border-border w-full max-w-md rounded-2xl border shadow-md"
            />
          }

          <div />
        </div>
      </div>

      <div className="border-border dark:bg-background z-10 min-h-[min(800px,80vh)] w-full max-w-lg rounded-xl border bg-neutral-100 p-6">
        <Stepper currentStep={step} onStepChanged={setStep} setCurrentStep={setStep}>
          <>
            <h1 className="text-2xl font-semibold">Create a new account</h1>

            <p className="text-muted-foreground mt-2 text-sm">
              Create your account and start using state-of-the-art document signing. Open and
              beautiful signing is within your grasp.
            </p>

            <hr className="-mx-6 my-4" />

            <SignUpFormV2
              initialEmail={email || undefined}
              isGoogleSSOEnabled={isGoogleSSOEnabled || true}
            />

            <p className="text-muted-foreground mt-6 text-center text-sm">
              Already have an account?{' '}
              <Link href="/signin" className="text-primary duration-200 hover:opacity-70">
                Sign in instead
              </Link>
            </p>
          </>
        </Stepper>
      </div>
    </div>
  );
};
