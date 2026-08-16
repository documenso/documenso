import { trpc } from '@documenso/trpc/react';
import type { TGetApiTokensResponse } from '@documenso/trpc/server/api-token-router/get-api-tokens.types';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { DataTable, type DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { TeamMemberRole } from '@prisma/client';
import { useMemo } from 'react';

import { TokenCreateDialog } from '~/components/dialogs/token-create-dialog';
import TokenDeleteDialog from '~/components/dialogs/token-delete-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { useOptionalCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`API Tokens`);
}

export default function ApiTokensPage() {
  const { t, i18n } = useLingui();

  const team = useOptionalCurrentTeam();

  const isUnauthorized = !!team && team.currentTeamRole !== TeamMemberRole.ADMIN;

  const {
    data: tokens,
    isLoading,
    isError,
  } = trpc.apiToken.getMany.useQuery(undefined, {
    enabled: !isUnauthorized,
  });

  const columns = useMemo(() => {
    return [
      {
        header: t`Name`,
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
      },
      {
        header: t`Created`,
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
      {
        header: t`Expires`,
        cell: ({ row }) => {
          if (!row.original.expires) {
            return (
              <span className="text-muted-foreground">
                <Trans>Never</Trans>
              </span>
            );
          }

          if (row.original.expires < new Date()) {
            return (
              <Badge variant="destructive" size="small">
                <Trans>Expired</Trans>
              </Badge>
            );
          }

          return i18n.date(row.original.expires);
        },
      },
      {
        header: t`Actions`,
        cell: ({ row }) => (
          <TokenDeleteDialog token={row.original}>
            <Button variant="destructive">
              <Trans>Delete</Trans>
            </Button>
          </TokenDeleteDialog>
        ),
      },
    ] satisfies DataTableColumnDef<TGetApiTokensResponse[number]>[];
  }, []);

  return (
    <div>
      <SettingsHeader
        title={<Trans>API Tokens</Trans>}
        subtitle={
          <Trans>
            Create and manage API tokens. See our{' '}
            <a
              className="text-primary underline"
              href={'https://docs.documenso.com/developers/public-api'}
              target="_blank"
              rel="noopener"
            >
              documentation
            </a>{' '}
            for more information.
          </Trans>
        }
      >
        {!isUnauthorized && <TokenCreateDialog />}
      </SettingsHeader>

      {isUnauthorized ? (
        <Alert className="flex flex-col items-center justify-between gap-4 p-6 md:flex-row" variant="warning">
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
        <DataTable
          columns={columns}
          data={tokens ?? []}
          perPage={0}
          currentPage={0}
          totalPages={0}
          error={{
            enable: isError,
          }}
          emptyState={
            <div className="flex h-60 flex-col items-center justify-center gap-y-4 text-muted-foreground/60">
              <p>
                <Trans>You have no API tokens yet. Your tokens will be shown here once you create them.</Trans>
              </p>
            </div>
          }
          skeleton={{
            enable: isLoading,
            rows: 3,
            component: (
              <>
                <TableCell>
                  <Skeleton className="h-4 w-24 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-12 rounded-full" />
                </TableCell>
              </>
            ),
          }}
        />
      )}
    </div>
  );
}
