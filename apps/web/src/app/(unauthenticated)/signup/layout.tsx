import React from 'react';

import { NewHeader } from '../../../components/(dashboard)/layout/new/new-header';

type SignUpLayoutProps = {
  children: React.ReactNode;
};

export default function SignUpLayout({ children }: SignUpLayoutProps) {
  return (
    <>
      <NewHeader className="mx-auto h-16 max-w-screen-xl px-4 md:h-20 lg:px-8" />
      <main
        className="bg-sand-100 scale-90 items-center justify-center px-4 md:h-20 lg:mx-28 lg:px-8"
        style={{ height: 'calc(100vh - 80px)' }}
      >
        <div className="grid grid-cols-12 gap-y-8 overflow-hidden p-2 lg:gap-x-8">{children}</div>
      </main>
    </>
  );
}
