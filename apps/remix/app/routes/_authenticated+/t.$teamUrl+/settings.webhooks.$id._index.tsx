import { useMemo, useState } from 'react';
import { useEffect } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { WebhookCallStatus, WebhookTriggerEvents } from '@prisma/client';
import {
  CheckCircle2Icon,
  ChevronRightIcon,
  PencilIcon,
  TerminalIcon,
  XCircleIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useLocation, useSearchParams } from 'react-router';
import { Link } from 'react-router';
import { z } from 'zod';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useIsMounted } from '@documenso/lib/client-only/hooks/use-is-mounted';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { toFriendlyWebhookEventName } from '@documenso/lib/universal/webhook/to-friendly-webhook-event-name';
import { trpc } from '@documenso/trpc/react';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Input } from '@documenso/ui/primitives/input';
import { MultiSelectCombobox } from '@documenso/ui/primitives/multi-select-combobox';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';
import { TableCell } from '@documenso/ui/primitives/table';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { WebhookEditDialog } from '~/components/dialogs/webhook-edit-dialog';
import { WebhookTestDialog } from '~/components/dialogs/webhook-test-dialog';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { SettingsHeader } from '~/components/general/settings-header';
import { WebhookLogsSheet } from '~/components/general/webhook-logs-sheet';
import { useCurrentTeam } from '~/providers/team';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/settings.webhooks.$id._index';

const WebhookSearchParamsSchema = ZUrlSearchParamsSchema.extend({
  status: z.nativeEnum(WebhookCallStatus).optional(),
  events: z.preprocess(
    (value) => (typeof value === 'string' && value.length > 0 ? value.split(',') : []),
    z.array(z.nativeEnum(WebhookTriggerEvents)).optional(),
  ),
});

export function meta() {
  return appMetaTags('Webhooks');
}

export default function WebhookPage({ params }: Route.ComponentProps) {
  const { t, i18n } = useLingui();
  const { toast } = useToast();

  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();
  const team = useCurrentTeam();

  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get('query') ?? '');

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

  const parsedSearchParams = WebhookSearchParamsSchema.parse(
    Object.fromEntries(searchParams ?? []),
  );

  const { data: webhook, isLoading } = trpc.webhook.getWebhookById.useQuery(
    {
      id: params.id,
    },
    { enabled: !!params.id, retry: false },
  );

  const {
    data,
    isLoading: isLogsLoading,
    isLoadingError: isLogsLoadingError,
  } = trpc.webhook.calls.find.useQuery({
    webhookId: params.id,
    page: parsedSearchParams.page,
    perPage: parsedSearchParams.perPage,
    status: parsedSearchParams.status,
    events: parsedSearchParams.events,
    query: parsedSearchParams.query,
  });

  /**
   * Handle debouncing the search query.
   */
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString());

    params.set('query', debouncedSearchQuery);

    if (debouncedSearchQuery === '') {
      params.delete('query');
    }

    // If nothing  to change then do nothing.
    if (params.toString() === searchParams?.toString()) {
      return;
    }

    setSearchParams(params);
  }, [debouncedSearchQuery, pathname, searchParams]);

  const onPaginationChange = (page: number, perPage: number) => {
    updateSearchParams({
      page,
      perPage,
    });
  };

  const results = data ?? {
    data: [],
    perPage: 10,
    currentPage: 1,
    totalPages: 1,
  };

  const columns = useMemo(() => {
    return [
      {
        header: t`Status`,
        accessorKey: 'status',

        cell: ({ row }) => (
          <Badge variant={row.original.status === 'SUCCESS' ? 'default' : 'destructive'}>
            {row.original.status === 'SUCCESS' ? (
              <CheckCircle2Icon className="mr-2 h-4 w-4" />
            ) : (
              <XCircleIcon className="mr-2 h-4 w-4" />
            )}
            {row.original.responseCode}
          </Badge>
        ),
      },
      {
        header: t`Event`,
        accessorKey: 'event',
        cell: ({ row }) => (
          <div>
            <p className="text-foreground text-sm font-semibold">
              {toFriendlyWebhookEventName(row.original.event)}
            </p>
            <p className="text-muted-foreground text-xs">{row.original.id}</p>
          </div>
        ),
      },
      {
        header: t`Sent`,
        accessorKey: 'createdAt',
        cell: ({ row }) => (
          <div className="flex items-center justify-between gap-2">
            <p>
              {i18n.date(row.original.createdAt, {
                timeStyle: 'short',
                dateStyle: 'short',
              })}
            </p>

            <div className="data-state-selected:block opacity-0 transition-opacity group-hover:opacity-100">
              <ChevronRightIcon className="h-4 w-4" />
            </div>
          </div>
        ),
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, []);

  const getTabHref = (value: string) => {
    const params = new URLSearchParams(searchParams);

    params.set('status', value);

    if (value === '') {
      params.delete('status');
    }

    if (params.has('page')) {
      params.delete('page');
    }

    let path = pathname;

    if (params.toString()) {
      path += `?${params.toString()}`;
    }

    return path;
  };

  if (isLoading) {
    return <SpinnerBox className="py-32" />;
  }

  // Todo: Update UI, currently out of place.
  if (!webhook) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`Webhook not found`,
            subHeading: msg`404 Webhook not found`,
            message: msg`The webhook you are looking for may have been removed, renamed or may have never existed.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to={`/t/${team.url}/settings/webhooks`}>
              <Trans>Go back</Trans>
            </Link>
          </Button>
        }
        secondaryButton={null}
      />
    );
  }

  return (
    <div>
      <SettingsHeader
        title={
          <div className="flex items-center gap-2">
            <p>
              <Trans>Webhook</Trans>
            </p>
            <Badge variant={webhook.enabled ? 'default' : 'secondary'}>
              {webhook.enabled ? <Trans>Enabled</Trans> : <Trans>Disabled</Trans>}
            </Badge>
          </div>
        }
        subtitle={webhook.webhookUrl}
      >
        <div className="flex gap-2">
          <WebhookTestDialog webhook={webhook}>
            <Button variant="outline">
              <TerminalIcon className="mr-2 h-4 w-4" />
              <Trans>Test</Trans>
            </Button>
          </WebhookTestDialog>

          <WebhookEditDialog
            webhook={webhook}
            trigger={
              <Button>
                <PencilIcon className="mr-2 h-4 w-4" />
                <Trans>Edit</Trans>
              </Button>
            }
          />
        </div>
      </SettingsHeader>

      <div className="mt-4">
        <div className="mb-4 flex flex-row items-center justify-between gap-x-4">
          <Input
            defaultValue={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t`Search by ID`}
          />

          <WebhookEventCombobox />

          <Tabs value={parsedSearchParams.status || ''} className="flex-shrink-0">
            <TabsList>
              <TabsTrigger className="hover:text-foreground min-w-[60px]" value="" asChild>
                <Link to={getTabHref('')}>
                  <Trans>All</Trans>
                </Link>
              </TabsTrigger>
              <TabsTrigger className="hover:text-foreground min-w-[60px]" value="SUCCESS" asChild>
                <Link to={getTabHref(WebhookCallStatus.SUCCESS)}>
                  <Trans>Success</Trans>
                </Link>
              </TabsTrigger>
              <TabsTrigger className="hover:text-foreground min-w-[60px]" value="FAILED" asChild>
                <Link to={getTabHref(WebhookCallStatus.FAILED)}>
                  <Trans>Failed</Trans>
                </Link>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <DataTable
          columns={columns}
          data={results.data}
          perPage={results.perPage}
          currentPage={results.currentPage}
          totalPages={results.totalPages}
          onPaginationChange={onPaginationChange}
          onRowClick={(row) =>
            WebhookLogsSheet.call({
              webhookCall: row,
            })
          }
          rowClassName="cursor-pointer group"
          error={{
            enable: isLogsLoadingError,
          }}
          skeleton={{
            enable: isLogsLoading,
            rows: 3,
            component: (
              <>
                <TableCell>
                  <Skeleton className="h-4 w-12 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-12 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-12 rounded-full" />
                </TableCell>
              </>
            ),
          }}
        >
          {(table) =>
            results.totalPages > 1 && (
              <DataTablePagination additionalInformation="VisibleCount" table={table} />
            )
          }
        </DataTable>
      </div>

      <WebhookLogsSheet.Root />
    </div>
  );
}

const WebhookEventCombobox = () => {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isMounted = useIsMounted();

  const events = (searchParams?.get('events') ?? '').split(',').filter((value) => value !== '');

  const comboBoxOptions = Object.values(WebhookTriggerEvents).map((event) => ({
    label: toFriendlyWebhookEventName(event),
    value: event,
  }));

  const onChange = (newEvents: string[]) => {
    if (!pathname) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString());

    params.set('events', newEvents.join(','));

    if (newEvents.length === 0) {
      params.delete('events');
    }

    void navigate(`${pathname}?${params.toString()}`, { preventScrollReset: true });
  };

  return (
    <MultiSelectCombobox
      emptySelectionPlaceholder={
        <p className="text-muted-foreground font-normal">
          <Trans>
            <span className="text-muted-foreground/70">Events:</span> All
          </Trans>
        </p>
      }
      enableClearAllButton={true}
      inputPlaceholder={msg`Search`}
      loading={!isMounted}
      options={comboBoxOptions}
      selectedValues={events}
      onChange={onChange}
    />
  );
};
