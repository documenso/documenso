import { toFriendlyWebhookEventName } from '@documenso/lib/universal/webhook/to-friendly-webhook-event-name';
import { trpc } from '@documenso/trpc/react';
import { Badge } from '@documenso/ui/primitives/badge';
import { DataTable, type DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { msg } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import type { Webhook } from '@prisma/client';
import { EditIcon, Loader, MoreHorizontalIcon, ScrollTextIcon, Trash2Icon } from 'lucide-react';
import { memo, useMemo } from 'react';
import { Link } from 'react-router';

import { WebhookCreateDialog } from '~/components/dialogs/webhook-create-dialog';
import { WebhookDeleteDialog } from '~/components/dialogs/webhook-delete-dialog';
import { WebhookEditDialog } from '~/components/dialogs/webhook-edit-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Webhooks`);
}

type WebhookTableWebhookCellProps = {
  webhook: Webhook;
  teamUrl: string;
};

const WebhookTableWebhookCell = memo(({ webhook, teamUrl }: WebhookTableWebhookCellProps) => {
  return (
    <Link to={`/t/${teamUrl}/settings/webhooks/${webhook.id}`}>
      <p className="text-muted-foreground text-xs">{webhook.id}</p>
      <p className="max-w-sm truncate font-semibold text-foreground text-xs" title={webhook.webhookUrl}>
        {webhook.webhookUrl}
      </p>
    </Link>
  );
});
WebhookTableWebhookCell.displayName = 'WebhookTableWebhookCell';

type WebhookTableStatusCellProps = {
  enabled: boolean;
};

const WebhookTableStatusCell = memo(({ enabled }: WebhookTableStatusCellProps) => {
  return (
    <Badge variant={enabled ? 'default' : 'neutral'} size="small">
      {enabled ? <Trans>Enabled</Trans> : <Trans>Disabled</Trans>}
    </Badge>
  );
});
WebhookTableStatusCell.displayName = 'WebhookTableStatusCell';

type WebhookTableEventsCellProps = {
  eventTriggers: Webhook['eventTriggers'];
};

const WebhookTableEventsCell = memo(({ eventTriggers }: WebhookTableEventsCellProps) => {
  return (
    <p className="text-foreground" title={eventTriggers.map((event) => toFriendlyWebhookEventName(event)).join(', ')}>
      <Plural value={eventTriggers.length} one="# Event" other="# Events" />
    </p>
  );
});
WebhookTableEventsCell.displayName = 'WebhookTableEventsCell';

type WebhookTableCreatedCellProps = {
  createdAt: Date;
};

const WebhookTableCreatedCell = memo(({ createdAt }: WebhookTableCreatedCellProps) => {
  const { i18n } = useLingui();

  return i18n.date(createdAt);
});
WebhookTableCreatedCell.displayName = 'WebhookTableCreatedCell';

type WebhookTableActionsCellProps = {
  webhook: Webhook;
};

const WebhookTableActionsCell = memo(({ webhook }: WebhookTableActionsCellProps) => {
  return <WebhookTableActionDropdown webhook={webhook} />;
});
WebhookTableActionsCell.displayName = 'WebhookTableActionsCell';

type CreateWebhookTableColumnsOptions = {
  teamUrl: string;
  t: (template: TemplateStringsArray) => string;
};

const createWebhookTableColumns = ({ teamUrl, t }: CreateWebhookTableColumnsOptions) => {
  function WebhookColumnCell({ row }: Readonly<{ row: { original: Webhook } }>) {
    return <WebhookTableWebhookCell webhook={row.original} teamUrl={teamUrl} />;
  }

  function StatusColumnCell({ row }: Readonly<{ row: { original: Webhook } }>) {
    return <WebhookTableStatusCell enabled={row.original.enabled} />;
  }

  function EventsColumnCell({ row }: Readonly<{ row: { original: Webhook } }>) {
    return <WebhookTableEventsCell eventTriggers={row.original.eventTriggers} />;
  }

  function CreatedColumnCell({ row }: Readonly<{ row: { original: Webhook } }>) {
    return <WebhookTableCreatedCell createdAt={row.original.createdAt} />;
  }

  function ActionsColumnCell({ row }: Readonly<{ row: { original: Webhook } }>) {
    return <WebhookTableActionsCell webhook={row.original} />;
  }

  return [
    {
      header: t`Webhook`,
      cell: WebhookColumnCell,
    },
    {
      header: t`Status`,
      cell: StatusColumnCell,
    },
    {
      header: t`Listening to`,
      cell: EventsColumnCell,
    },
    {
      header: t`Created`,
      cell: CreatedColumnCell,
    },
    {
      header: t`Actions`,
      cell: ActionsColumnCell,
    },
  ] satisfies DataTableColumnDef<Webhook>[];
};

export default function WebhookPage() {
  const { t } = useLingui();

  const team = useCurrentTeam();

  const { data, isLoading, isError } = trpc.webhook.getTeamWebhooks.useQuery({});

  const results = {
    data: data ?? [],
    perPage: 0,
    currentPage: 0,
    totalPages: 0,
  };

  const columns = useMemo(() => createWebhookTableColumns({ teamUrl: team.url, t }), [t, team.url]);

  return (
    <div>
      <SettingsHeader
        hideDivider
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
          <div className="flex h-60 flex-col items-center justify-center gap-y-4 text-muted-foreground/60">
            <p>
              <Trans>You have no webhooks yet. Your webhooks will be shown here once you create them.</Trans>
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
        <MoreHorizontalIcon className="h-5 w-5 text-muted-foreground" />
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
