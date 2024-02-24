import React from 'react';

import { Card } from '@documenso/ui/primitives/card';

import ClaimUsernameCard from '../../../components/(dashboard)/claim-username-card/claim-username-card';
import { NewHeader } from '../../../components/(dashboard)/layout/new/new-header';

type SignUpLayoutProps = {
  children: React.ReactNode;
};

export default function SignUpLayout({ children }: SignUpLayoutProps) {
  return (
    <>
      <NewHeader className="mx-auto h-16 max-w-screen-xl px-4 md:h-20 lg:px-8" />
      <main className="bg-sand-100 flex flex-col items-center justify-center overflow-hidden px-6 py-16 md:p-10 lg:p-[7.0rem]">
        <div className="flex w-full items-center gap-x-8">
          <ClaimUsernameCard />
          <Card className="px-6 py-6">
            <div className="w-full">{children}</div>
          </Card>
        </div>
      </main>
    </>
  );
}
