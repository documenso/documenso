import { useMemo, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';

import { authClient } from '@documenso/auth/client';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Linked Accounts');
}

export default function SettingsSecurityLinkedAccounts() {
  const { t } = useLingui();

  const { data, isLoading, isLoadingError, refetch } = useQuery({
    queryKey: ['linked-accounts'],
    queryFn: async () => await authClient.account.getMany(),
  });

  const results = data?.accounts ?? [];

  const columns = useMemo(() => {
    return [
      {
        header: t`Provider`,
        accessorKey: 'provider',
        cell: ({ row }) => row.original.provider,
      },
      {
        header: t`Linked At`,
        accessorKey: 'createdAt',
        cell: ({ row }) =>
          row.original.createdAt
            ? DateTime.fromJSDate(row.original.createdAt).toRelative()
            : t`Unknown`,
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <AccountUnlinkDialog
            accountId={row.original.id}
            provider={row.original.provider}
            onSuccess={refetch}
          />
        ),
      },
    ] satisfies DataTableColumnDef<(typeof results)[number]>[];
  }, []);

  return (
    <div>
      <SettingsHeader
        title={t`Linked Accounts`}
        subtitle={t`View and manage all login methods linked to your account.`}
      />

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

type AccountUnlinkDialogProps = {
  accountId: string;
  provider: string;
  onSuccess: () => Promise<unknown>;
};

const AccountUnlinkDialog = ({ accountId, onSuccess, provider }: AccountUnlinkDialogProps) => {
  const { toast } = useToast();
  const { t } = useLingui();

  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleRevoke = async () => {
    setIsLoading(true);

    try {
      await authClient.account.delete(accountId);

      await onSuccess();

      toast({
        title: t`Account unlinked`,
      });
    } catch (error) {
      console.error(error);

      toast({
        title: t`Error`,
        description: t`Failed to unlink account`,
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isLoading && setOpen(value)}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trans>Unlink</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Are you sure?</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>
              You are about to remove the <span className="font-semibold">{provider}</span> login
              method from your account.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            <Trans>Cancel</Trans>
          </Button>

          <Button variant="destructive" loading={isLoading} onClick={handleRevoke}>
            <Trans>Unlink</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
