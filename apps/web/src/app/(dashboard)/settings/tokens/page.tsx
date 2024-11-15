import { Trans } from '@lingui/macro';
import { DateTime } from 'luxon';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getUserTokens } from '@documenso/lib/server-only/public-api/get-all-user-tokens';
import { Button } from '@documenso/ui/primitives/button';

import DeleteTokenDialog from '~/components/(dashboard)/settings/token/delete-token-dialog';
import { ApiTokenForm } from '~/components/forms/token';

export default async function ApiTokensPage() {
  const { i18n } = await setupI18nSSR();

  const { user } = await getRequiredServerComponentSession();

  const tokens = await getUserTokens({ userId: user.id });

  return (
    <div>
      <h3 className="text-2xl font-semibold">
        <Trans>API Tokens</Trans>
      </h3>

      <p className="text-muted-foreground mt-2 text-sm">
        <Trans>
          On this page, you can create new API tokens and manage the existing ones. <br />
          Also see our{' '}
          <a
            className="text-primary underline"
            href={'https://docs.documenso.com/developers/public-api'}
            target="_blank"
          >
            Documentation
          </a>
          .
        </Trans>
      </p>

      <hr className="my-4" />

      <ApiTokenForm className="max-w-xl" tokens={tokens} />

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
                  <DeleteTokenDialog token={token}>
                    <Button variant="destructive">
                      <Trans>Delete</Trans>
                    </Button>
                  </DeleteTokenDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
