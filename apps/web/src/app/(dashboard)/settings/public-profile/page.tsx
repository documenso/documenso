import type { Metadata } from 'next';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { Switch } from '@documenso/ui/primitives/switch';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import { LinkTemplatesForm } from '~/components/forms/link-templates';
import { PublicProfileForm } from '~/components/forms/public-profile';

export const metadata: Metadata = {
  title: 'Public profile',
};

export default async function PublicProfileSettingsPage() {
  const { user } = await getRequiredServerComponentSession();

  return (
    <div>
      <SettingsHeader
        title="Public profile"
        subtitle="You can choose to enable/disable your profile for public view"
        className="justify"
      >
        <div className="flex flex-row">
          <label className="mr-2 text-white" htmlFor="hide">
            Hide
          </label>
          <Switch />
          <label className="ml-2 text-white" htmlFor="show">
            Show
          </label>
        </div>
      </SettingsHeader>

      <PublicProfileForm className="mb-8 max-w-xl" user={user} />

      <LinkTemplatesForm />
    </div>
  );
}
