import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DateTime } from 'luxon';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { getTeamTokens } from '@documenso/lib/server-only/public-api/get-all-team-tokens';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { Button } from '@documenso/ui/primitives/button';

import TokenDeleteDialog from '~/components/dialogs/token-delete-dialog';
import { ApiTokenForm } from '~/components/forms/token';

import type { Route } from './+types/tokens';

// Todo: This can be optimized.
export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  const team = await getTeamByUrl({
    userId: user.id,
    teamUrl: params.teamUrl,
  });

  const tokens = await getTeamTokens({ userId: user.id, teamId: team.id }).catch(() => null);

  return {
    user,
    team,
    tokens,
  };
}

export default function ApiTokensPage({ loaderData }: Route.ComponentProps) {
  const { i18n } = useLingui();

  const { team, tokens } = loaderData;

  if (!tokens) {
    return (
      <div>
        <h3 className="text-2xl font-semibold">
          <Trans>API Tokens</Trans>
        </h3>
        <p className="text-muted-foreground mt-2 text-sm">
          <Trans>Something went wrong.</Trans>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-2xl font-semibold">
        <Trans>API Tokens</Trans>
      </h3>

      <p className="text-muted-foreground mt-2 text-sm">
        <Trans>
          On this page, you can create new API tokens and manage the existing ones. <br />
          You can view our swagger docs{' '}
          <a
            className="text-primary underline"
            href={`${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/openapi`}
            target="_blank"
          >
            here
          </a>
        </Trans>
      </p>

      <hr className="my-4" />

      <ApiTokenForm className="max-w-xl" teamId={team.id} tokens={tokens} />

      <hr className="mb-4 mt-8" />

      <h4 className="text-xl font-medium">
        <Trans>Your existing tokens</Trans>
      </h4>

      {tokens.length === 0 && (
        <div className="mb-4">
          <p className="text-muted-foreground mt-2 text-sm italic">
            <Trans>Your tokens will be shown here once you create them.</Trans>
          </p>
        </div>
      )}

      {tokens.length > 0 && (
        <div className="mt-4 flex max-w-xl flex-col gap-y-4">
          {tokens.map((token) => (
            <div key={token.id} className="border-border rounded-lg border p-4">
              <div className="flex items-center justify-between gap-x-4">
                <div>
                  <h5 className="text-base">{token.name}</h5>

                  <p className="text-muted-foreground mt-2 text-xs">
                    <Trans>Created on {i18n.date(token.createdAt, DateTime.DATETIME_FULL)}</Trans>
                  </p>
                  {token.expires ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      <Trans>Expires on {i18n.date(token.expires, DateTime.DATETIME_FULL)}</Trans>
                    </p>
                  ) : (
                    <p className="text-muted-foreground mt-1 text-xs">
                      <Trans>Token doesn't have an expiration date</Trans>
                    </p>
                  )}
                </div>

                <div>
                  <TokenDeleteDialog token={token} teamId={team.id}>
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
    </div>
  );
}
