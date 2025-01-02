import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import { AvatarImageForm } from '~/components/forms/avatar-image';
import { ProfileForm } from '~/components/forms/profile';

import type { Route } from './+types/profile';

// import { DeleteAccountDialog } from './settings/profile/delete-account-dialog';

export function meta(_args: Route.MetaArgs) {
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

      {/* <DeleteAccountDialog className="max-w-xl" /> */}
    </div>
  );
}
