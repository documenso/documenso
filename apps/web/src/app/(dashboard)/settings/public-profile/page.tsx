import * as React from 'react';

import type { Metadata } from 'next';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { Switch } from '@documenso/ui/primitives/switch';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import { PublicProfileForm } from '~/components/forms/public-profile';

export const metadata: Metadata = {
  title: 'Public Profile',
};

export default async function PublicProfilePage() {
  const { user } = await getRequiredServerComponentSession();

  return (
    <>
      <SettingsHeader
        title="Public profile"
        subtitle="You can choose to enable/disable your profile for public view"
        titleChildren={<Switch></Switch>}
        className="max-w-xl"
      />

      <PublicProfileForm user={user} className="max-w-xl" />
    </>
  );
}
