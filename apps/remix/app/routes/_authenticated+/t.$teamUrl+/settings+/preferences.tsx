import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { TeamBrandingPreferencesForm } from '~/components/forms/team-branding-preferences-form';
import { TeamDocumentPreferencesForm } from '~/components/forms/team-document-preferences-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { useCurrentTeam } from '~/providers/team';

export default function TeamsSettingsPage() {
  const { _ } = useLingui();

  const team = useCurrentTeam();

  return (
    <div>
      <SettingsHeader
        title={_(msg`Team Preferences`)}
        subtitle={_(msg`Here you can set preferences and defaults for your team.`)}
      />

      <section>
        <TeamDocumentPreferencesForm team={team} settings={team.teamGlobalSettings} />
      </section>

      <SettingsHeader
        title={_(msg`Branding Preferences`)}
        subtitle={_(msg`Here you can set preferences and defaults for branding.`)}
        className="mt-8"
      />

      <section>
        <TeamBrandingPreferencesForm team={team} settings={team.teamGlobalSettings} />
      </section>
    </div>
  );
}
