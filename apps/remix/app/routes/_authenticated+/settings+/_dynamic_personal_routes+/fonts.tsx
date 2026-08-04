import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';

import { FontManagementForm } from '~/components/forms/font-management-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Fonts`);
}

export default function PersonalFontsPage() {
  const { t } = useLingui();

  return (
    <div className="max-w-2xl">
      <SettingsHeader title={t`Fonts`} subtitle={t`Manage fonts available in your personal workspace.`} />

      <section>
        <FontManagementForm target={{ type: 'personal' }} />
      </section>
    </div>
  );
}
