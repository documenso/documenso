import { useMemo, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { UAParser } from 'ua-parser-js';

import { authClient } from '@documenso/auth/client';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { SessionLogoutAllDialog } from '~/components/dialogs/session-logout-all-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Active Sessions');
}

const parser = new UAParser();

export default function SettingsSecuritySessions() {
  const { t } = useLingui();

  const { data, isLoading, isLoadingError, refetch } = useQuery({
    queryKey: ['active-sessions'],
    queryFn: async () => await authClient.getSessions(),
  });

  const { session } = useSession();

  const results = data?.sessions ?? [];

  const columns = useMemo(() => {
    return [
      {
        header: t`Device`,
        accessorKey: 'userAgent',
        cell: ({ row }) => {
          const userAgent = row.original.userAgent || '';
          parser.setUA(userAgent);

          const result = parser.getResult();
          const browser = result.browser.name || t`Unknown`;
          const os = result.os.name || t`Unknown`;
          const isCurrentSession = row.original.id === session?.id;

          return (
            <div className="flex items-center gap-2">
              <span>
                {browser} ({os})
              </span>
              {isCurrentSession && (
                <Badge>
                  <Trans>Current</Trans>
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        header: t`IP Address`,
        accessorKey: 'ipAddress',
        cell: ({ row }) => row.original.ipAddress || t`Unknown`,
      },
      {
        header: t`Last Active`,
        accessorKey: 'updatedAt',
        cell: ({ row }) => DateTime.fromJSDate(row.original.updatedAt).toRelative(),
      },
      {
        header: t`Created`,
        accessorKey: 'createdAt',
        cell: ({ row }) => DateTime.fromJSDate(row.original.createdAt).toRelative(),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <SessionRevokeButton
            sessionId={row.original.id}
            isCurrentSession={row.original.id === session?.id}
            onSuccess={refetch}
          />
        ),
      },
    ] satisfies DataTableColumnDef<(typeof results)[number]>[];
  }, []);

  return (
    <div>
      <SettingsHeader
        title={t`Active sessions`}
        subtitle={t`View and manage all active sessions for your account.`}
      >
        <SessionLogoutAllDialog onSuccess={refetch} disabled={results.length === 1 || isLoading} />
      </SettingsHeader>

      <div className="mt-4">
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
                  <Skeleton className="h-4 w-24 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-16 rounded" />
                </TableCell>
              </>
            ),
          }}
        />
      </div>
    </div>
  );
}

type SessionRevokeButtonProps = {
  sessionId: string;
  isCurrentSession: boolean;
  onSuccess: () => Promise<unknown>;
};

const SessionRevokeButton = ({
  sessionId,
  isCurrentSession,
  onSuccess,
}: SessionRevokeButtonProps) => {
  const { toast } = useToast();
  const { t } = useLingui();

  const [isLoading, setIsLoading] = useState(false);

  const handleRevoke = async () => {
    setIsLoading(true);
    try {
      await authClient.signOutSession({
        sessionId,
        redirectPath: isCurrentSession ? '/signin' : undefined,
      });

      if (!isCurrentSession) {
        await onSuccess();
      }

      toast({
        title: t`Session revoked`,
      });
    } catch (error) {
      console.error(error);

      toast({
        title: t`Error`,
        description: t`Failed to revoke session`,
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  return (
    <Button variant="destructive" size="sm" onClick={handleRevoke} loading={isLoading}>
      <Trans>Revoke</Trans>
    </Button>
  );
};
