import React from 'react';

import Image from 'next/image';

import backgroundPattern from '@documenso/assets/images/background-pattern.png';
import { Card } from '@documenso/ui/primitives/card';

import { NewHeader } from '../../../components/(dashboard)/layout/new/new-header';

type CheckEmailLayoutProps = {
  children: React.ReactNode;
};

export default function CheckEmailLayout({ children }: CheckEmailLayoutProps) {
  return (
    <>
      <NewHeader className="mx-auto h-16 max-w-screen-xl px-4 md:h-20 lg:px-8" />
      <main className="bg-sand-100 relative flex min-h-screen flex-col items-center justify-center overflow-hidden  px-4 py-12 md:p-12 lg:p-24">
        <div className="relative flex w-full max-w-md items-center gap-x-24">
          <div className="absolute -inset-96 -z-[1] flex items-center justify-center opacity-50">
            <Image
              src={backgroundPattern}
              alt="background pattern"
              className="dark:brightness-95 dark:contrast-[70%] dark:invert dark:sepia"
            />
          </div>
          <Card className="px-6 py-6">
            <div className="w-full">{children}</div>
          </Card>
        </div>
      </main>
    </>
  );
}
