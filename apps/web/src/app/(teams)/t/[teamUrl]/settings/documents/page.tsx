import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import { TeamDocumentSettings } from '~/components/forms/team-document-settings';

export type TeamDocumentSettingsPageProps = { params: { teamUrl: string } };

export default async function TeamDocumentSettingsPage({ params }: TeamDocumentSettingsPageProps) {
  setupI18nSSR();

  const { _ } = useLingui();

  const { teamUrl } = params;

  const { user } = await getRequiredServerComponentSession();
  const team = await getTeamByUrl({ userId: user.id, teamUrl });

  return (
    <div>
      <SettingsHeader
        title={_(msg`Document Settings`)}
        subtitle={_(msg`The global settings for the documents in your team account.`)}
        hideDivider={true}
      />

      <p className="text-muted-foreground mt-2 text-sm">
        <Trans>
          Check out the documentaton for the{' '}
          <a
            className="text-primary italic underline"
            href={'https://docs.documenso.com/users/teams/global-settings'}
            target="_blank"
          >
            global team settings
          </a>
          .
        </Trans>
      </p>

      <hr className="my-4" />

      <TeamDocumentSettings team={team} />
    </div>
  );
}
