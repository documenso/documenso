import * as React from 'react';

import type { Metadata } from 'next';
import Link from 'next/link';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';

export const metadata: Metadata = {
  title: 'Public Profile',
};

export default function PublicProfilePage() {
  return (
    <>
      <SettingsHeader
        title="Public profile"
        subtitle=""
        className="max-w-xl"
        titleChildren={
          <Link
            href="#"
            className="bg-primary dark:text-background ml-2 rounded-full px-2 py-1 text-xs font-semibold sm:px-3"
          >
            Coming soon!
          </Link>
        }
      />
    </>
  );
}
