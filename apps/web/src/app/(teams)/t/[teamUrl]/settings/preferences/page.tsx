import { msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';

import { TeamBrandingPreferencesForm } from './branding-preferences';
import { TeamDocumentPreferencesForm } from './document-preferences';

export type TeamsSettingsPageProps = {
  params: {
    teamUrl: string;
  };
};

export default async function TeamsSettingsPage({ params }: TeamsSettingsPageProps) {
  await setupI18nSSR();

  const { _ } = useLingui();

  const { teamUrl } = params;

  const session = await getRequiredServerComponentSession();

  const team = await getTeamByUrl({ userId: session.user.id, teamUrl });

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
