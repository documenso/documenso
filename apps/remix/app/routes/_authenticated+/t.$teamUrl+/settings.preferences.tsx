import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';

import { TeamBrandingPreferencesForm } from '~/components/forms/team-branding-preferences-form';
import { TeamDocumentPreferencesForm } from '~/components/forms/team-document-preferences-form';
import { SettingsHeader } from '~/components/general/settings-header';

import type { Route } from './+types/settings.preferences';

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  const team = await getTeamByUrl({ userId: user.id, teamUrl: params.teamUrl });

  return {
    team,
  };
}

export default function TeamsSettingsPage({ loaderData }: Route.ComponentProps) {
  const { team } = loaderData;

  const { _ } = useLingui();

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
