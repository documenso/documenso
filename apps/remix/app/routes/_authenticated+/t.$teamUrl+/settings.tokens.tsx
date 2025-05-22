import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { TeamMemberRole } from '@prisma/client';
import { DateTime } from 'luxon';

import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';

import TokenDeleteDialog from '~/components/dialogs/token-delete-dialog';
import { ApiTokenForm } from '~/components/forms/token';
import { SettingsHeader } from '~/components/general/settings-header';
import { useOptionalCurrentTeam } from '~/providers/team';

export default function ApiTokensPage() {
  const { i18n } = useLingui();

  const { data: tokens } = trpc.apiToken.getTokens.useQuery();

  const team = useOptionalCurrentTeam();

  return (
    <div>
      <SettingsHeader
        title={<Trans>API Tokens</Trans>}
        subtitle={
          <Trans>
            On this page, you can create and manage API tokens. See our{' '}
            <a
              className="text-primary underline"
              href={'https://docs.documenso.com/developers/public-api'}
              target="_blank"
            >
              Documentation
            </a>{' '}
            for more information.
          </Trans>
        }
      />

      {team && team?.currentTeamRole !== TeamMemberRole.ADMIN ? (
        <Alert
          className="flex flex-col items-center justify-between gap-4 p-6 md:flex-row"
          variant="warning"
        >
          <div>
            <AlertTitle>
              <Trans>Unauthorized</Trans>
            </AlertTitle>
            <AlertDescription className="mr-2">
              <Trans>You need to be an admin to manage API tokens.</Trans>
            </AlertDescription>
          </div>
        </Alert>
      ) : (
        <>
          <ApiTokenForm className="max-w-xl" tokens={tokens} />

          <hr className="mb-4 mt-8" />

          <h4 className="text-xl font-medium">
            <Trans>Your existing tokens</Trans>
          </h4>

          {tokens && tokens.length === 0 && (
            <div className="mb-4">
              <p className="text-muted-foreground mt-2 text-sm italic">
                <Trans>Your tokens will be shown here once you create them.</Trans>
              </p>
            </div>
          )}

          {tokens && tokens.length > 0 && (
            <div className="mt-4 flex max-w-xl flex-col gap-y-4">
              {tokens.map((token) => (
                <div key={token.id} className="border-border rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-x-4">
                    <div>
                      <h5 className="text-base">{token.name}</h5>

                      <p className="text-muted-foreground mt-2 text-xs">
                        <Trans>
                          Created on {i18n.date(token.createdAt, DateTime.DATETIME_FULL)}
                        </Trans>
                      </p>
                      {token.expires ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          <Trans>
                            Expires on {i18n.date(token.expires, DateTime.DATETIME_FULL)}
                          </Trans>
                        </p>
                      ) : (
                        <p className="text-muted-foreground mt-1 text-xs">
                          <Trans>Token doesn't have an expiration date</Trans>
                        </p>
                      )}
                    </div>

                    <div>
                      <TokenDeleteDialog token={token}>
                        <Button variant="destructive">
                          <Trans>Delete</Trans>
                        </Button>
                      </TokenDeleteDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
