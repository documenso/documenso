import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';

import { FontManagementForm } from '~/components/forms/font-management-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Fonts`);
}

export default function TeamFontsPage() {
  const { t } = useLingui();
  const team = useCurrentTeam();

  return (
    <div className="max-w-2xl">
      <SettingsHeader title={t`Fonts`} subtitle={t`Manage fonts available to documents in this team.`} />

      <section>
        <FontManagementForm target={{ type: 'team', teamId: team.id }} />
      </section>
    </div>
  );
}
