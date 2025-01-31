import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import { AccountDeleteDialog } from '~/components/dialogs/account-delete-dialog';
import { AvatarImageForm } from '~/components/forms/avatar-image';
import { ProfileForm } from '~/components/forms/profile';

export function meta() {
  return [{ title: 'Profile' }];
}

export default function SettingsProfile() {
  const { _ } = useLingui();

  return (
    <div>
      <SettingsHeader
        title={_(msg`Profile`)}
        subtitle={_(msg`Here you can edit your personal details.`)}
      />

      <AvatarImageForm className="mb-8 max-w-xl" />
      <ProfileForm className="mb-8 max-w-xl" />

      <hr className="my-4 max-w-xl" />

      <AccountDeleteDialog className="max-w-xl" />
    </div>
  );
}
