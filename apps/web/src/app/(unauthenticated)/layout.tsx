import React from 'react';

import Image from 'next/image';

import backgroundPattern from '~/assets/background-pattern.png';

type UnauthenticatedLayoutProps = {
  children: React.ReactNode;
};

export default function UnauthenticatedLayout({ children }: UnauthenticatedLayoutProps) {
  return (
    <main className="bg-sand-100 relative flex min-h-screen flex-col items-center justify-center overflow-hidden  px-4 py-12 md:p-12 lg:p-24">
      <div className="relative flex w-full max-w-md items-center gap-x-24">
        <div className="absolute -inset-96 -z-[1] flex items-center justify-center opacity-50">
          <Image
            src={backgroundPattern}
            alt="background pattern"
            className="dark:brightness-95 dark:contrast-[70%] dark:invert dark:sepia"
          />
        </div>

        <div className="w-full">{children}</div>
      </div>
    </main>
  );
}
