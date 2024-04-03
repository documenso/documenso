import type { Metadata } from 'next';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import { ProfileForm } from '~/components/forms/profile';

import { ClaimProfileAlertDialog } from './claim-profile-alert-dialog';
import { DeleteAccountDialog } from './delete-account-dialog';

export const metadata: Metadata = {
  title: 'Profile',
};

export default async function ProfileSettingsPage() {
  const { user } = await getRequiredServerComponentSession();

  return (
    <div>
      <SettingsHeader title="Profile" subtitle="Here you can edit your personal details." />

      <ProfileForm className="mb-8 max-w-xl" user={user} />

      <ClaimProfileAlertDialog className="max-w-xl" user={user} />

      <hr className="my-4 max-w-xl" />

      <DeleteAccountDialog className="max-w-xl" user={user} />
    </div>
  );
}
