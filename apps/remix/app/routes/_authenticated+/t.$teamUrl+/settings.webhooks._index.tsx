import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { Plural, useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import type { Webhook } from '@prisma/client';
import {
  CheckCircle2Icon,
  EditIcon,
  Loader,
  MoreHorizontalIcon,
  ScrollTextIcon,
  Trash2Icon,
  XCircleIcon,
} from 'lucide-react';
import { DateTime } from 'luxon';
import { Link } from 'react-router';

import { toFriendlyWebhookEventName } from '@documenso/lib/universal/webhook/to-friendly-webhook-event-name';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { DataTable, type DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';

import { WebhookCreateDialog } from '~/components/dialogs/webhook-create-dialog';
import { WebhookDeleteDialog } from '~/components/dialogs/webhook-delete-dialog';
import { WebhookEditDialog } from '~/components/dialogs/webhook-edit-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Webhooks');
}

export default function WebhookPage() {
  const { t, i18n } = useLingui();

  const team = useCurrentTeam();

  const { data, isLoading, isError } = trpc.webhook.getTeamWebhooks.useQuery();

  const results = {
    data: data ?? [],
    perPage: 0,
    currentPage: 0,
    totalPages: 0,
  };

  const columns = useMemo(() => {
    return [
      {
        header: t`Webhook`,
        cell: ({ row }) => (
          <Link to={`/t/${team.url}/settings/webhooks/${row.original.id}`}>
            <p className="text-muted-foreground text-xs">{row.original.id}</p>
            <p
              className="text-foreground max-w-sm truncate text-xs font-semibold"
              title={row.original.webhookUrl}
            >
              {row.original.webhookUrl}
            </p>
          </Link>
        ),
      },
      {
        header: t`Status`,
        cell: ({ row }) => (
          <Badge variant={row.original.enabled ? 'default' : 'neutral'} size="small">
            {row.original.enabled ? <Trans>Enabled</Trans> : <Trans>Disabled</Trans>}
          </Badge>
        ),
      },
      {
        header: t`Listening to`,
        cell: ({ row }) => (
          <p
            className="text-foreground"
            title={row.original.eventTriggers
              .map((event) => toFriendlyWebhookEventName(event))
              .join(', ')}
          >
            <Plural value={row.original.eventTriggers.length} one="# Event" other="# Events" />
          </p>
        ),
      },
      {
        header: t`Created`,
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
      {
        header: t`Actions`,
        cell: ({ row }) => <WebhookTableActionDropdown webhook={row.original} />,
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, []);

  return (
    <div>
      <SettingsHeader
        title={t`Webhooks`}
        subtitle={t`On this page, you can create new Webhooks and manage the existing ones.`}
      >
        <WebhookCreateDialog />
      </SettingsHeader>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <Loader className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      )}

      <DataTable
        columns={columns}
        data={results.data}
        perPage={results.perPage}
        currentPage={results.currentPage}
        totalPages={results.totalPages}
        error={{
          enable: isError,
        }}
        emptyState={
          <div className="text-muted-foreground/60 flex h-60 flex-col items-center justify-center gap-y-4">
            <p>
              <Trans>
                You have no webhooks yet. Your webhooks will be shown here once you create them.
              </Trans>
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
                <Skeleton className="h-4 w-8 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-6 rounded-full" />
              </TableCell>
            </>
          ),
        }}
      />
    </div>
  );
}

const WebhookTableActionDropdown = ({ webhook }: { webhook: Webhook }) => {
  const team = useCurrentTeam();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger data-testid="webhook-table-action-btn">
        <MoreHorizontalIcon className="text-muted-foreground h-5 w-5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" forceMount>
        <DropdownMenuLabel>
          <Trans>Action</Trans>
        </DropdownMenuLabel>

        <DropdownMenuItem asChild>
          <Link to={`/t/${team.url}/settings/webhooks/${webhook.id}`}>
            <ScrollTextIcon className="mr-2 h-4 w-4" />
            <Trans>Logs</Trans>
          </Link>
        </DropdownMenuItem>

        <WebhookEditDialog
          webhook={webhook}
          trigger={
            <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
              <div>
                <EditIcon className="mr-2 h-4 w-4" />
                <Trans>Edit</Trans>
              </div>
            </DropdownMenuItem>
          }
        />

        <WebhookDeleteDialog webhook={webhook}>
          <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
            <div>
              <Trash2Icon className="mr-2 h-4 w-4" />
              <Trans>Delete</Trans>
            </div>
          </DropdownMenuItem>
        </WebhookDeleteDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
