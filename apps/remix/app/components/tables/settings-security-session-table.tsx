import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { DateTime } from 'luxon';
import { UAParser } from 'ua-parser-js';

import { authClient } from '@documenso/auth/client';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { trpc } from '@documenso/trpc/react';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

const parser = new UAParser();

export const SettingsSecuritySessionTable = () => {
  const { _ } = useLingui();
  const { data, isLoading, isLoadingError } = trpc.auth.getActiveSessions.useQuery();
  const { session } = useSession();

  const results = data ?? [];

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Device`),
        accessorKey: 'userAgent',
        cell: ({ row }) => {
          const userAgent = row.original.userAgent || '';
          parser.setUA(userAgent);

          const result = parser.getResult();
          const browser = result.browser.name || _(msg`Unknown`);
          const os = result.os.name || _(msg`Unknown`);
          const isCurrentSession = row.original.id === session?.id;

          return (
            <div className="flex items-center gap-2">
              <span>
                {browser} ({os})
              </span>
              {isCurrentSession && <Badge>{_(msg`Current`)}</Badge>}
            </div>
          );
        },
      },
      {
        header: _(msg`IP Address`),
        accessorKey: 'ipAddress',
        cell: ({ row }) => row.original.ipAddress || _(msg`Unknown`),
      },
      {
        header: _(msg`Last Active`),
        accessorKey: 'updatedAt',
        cell: ({ row }) =>
          DateTime.fromJSDate(row.original.updatedAt || row.original.createdAt).toRelative(),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <Button
            variant="destructive"
            size="sm"
            onClick={async () =>
              authClient.signOutSession({
                sessionId: row.original.id,
                redirectPath: '/settings/security',
              })
            }
          >
            {_(msg`Sign Out`)}
          </Button>
        ),
      },
    ] satisfies DataTableColumnDef<(typeof results)[number]>[];
  }, []);

  return (
    <DataTable
      columns={columns}
      data={results}
      hasFilters={false}
      error={{
        enable: isLoadingError,
      }}
      skeleton={{
        enable: isLoading,
        rows: 3,
        component: (
          <>
            <TableCell>
              <Skeleton className="h-4 w-40 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20 rounded-full" />
            </TableCell>
          </>
        ),
      }}
    />
  );
};
