import {
  ADMIN_RULE_ACTION_MAP,
  ADMIN_RULE_ACTION_RUN_STATUS_MAP,
} from '@documenso/lib/constants/admin-rules-translations';
import type { TAdminRuleActionRunStatus } from '@documenso/lib/types/admin-rules';
import { trpc } from '@documenso/trpc/react';
import type {
  TFindAdminRuleMatchesRequest,
  TFindAdminRuleMatchesResponse,
} from '@documenso/trpc/server/admin-router/rules/find-admin-rule-matches.types';
import { Badge } from '@documenso/ui/primitives/badge';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { useLingui } from '@lingui/react/macro';
import { DateTime } from 'luxon';
import { useMemo } from 'react';
import { Link } from 'react-router';

import { AdminRuleModeBadge, AdminRuleTriggerBadge } from '~/components/general/admin-rules/admin-rule-badges';

export type AdminRuleMatchesTableProps = {
  filters: Omit<TFindAdminRuleMatchesRequest, 'page' | 'perPage'>;
  page: number;
  perPage: number;
  onPaginationChange: (page: number, perPage: number) => void;
  /**
   * Shows the rule and trigger columns. Off when the table already lives on a rule's page.
   */
  showRule?: boolean;
  hasFilters?: boolean;
  onClearFilters?: () => void;
};

export const AdminRuleMatchesTable = ({
  filters,
  page,
  perPage,
  onPaginationChange,
  showRule = false,
  hasFilters,
  onClearFilters,
}: AdminRuleMatchesTableProps) => {
  const { t, i18n } = useLingui();

  const { data, isLoading, isLoadingError } = trpc.admin.rule.matches.find.useQuery(
    { ...filters, page, perPage },
    {
      placeholderData: (previousData) => previousData,
    },
  );

  const results = data ?? {
    data: [],
    count: 0,
    perPage,
    currentPage: page,
    totalPages: 1,
  };

  const columns = useMemo(() => {
    return [
      {
        header: t`When`,
        cell: ({ row }) => (
          <span title={i18n.date(row.original.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}>
            {DateTime.fromJSDate(row.original.createdAt).setLocale(i18n.locale).toRelative()}
          </span>
        ),
      },
      ...(showRule
        ? ([
            {
              header: t`Rule`,
              cell: ({ row }) => (
                <Link
                  to={`/admin/rules/${row.original.rule.id}`}
                  className="block max-w-[14rem] truncate font-medium hover:underline"
                  title={row.original.rule.name}
                >
                  {row.original.rule.name}
                </Link>
              ),
            },
            {
              header: t`Trigger`,
              cell: ({ row }) => <AdminRuleTriggerBadge trigger={row.original.trigger} />,
            },
          ] satisfies DataTableColumnDef<TFindAdminRuleMatchesResponse['data'][number]>[])
        : []),
      {
        header: t`User`,
        cell: ({ row }) =>
          row.original.actorUser ? (
            <Link
              to={`/admin/users/${row.original.actorUser.id}`}
              className="block max-w-[14rem] truncate hover:underline"
              title={row.original.actorUser.email}
            >
              {row.original.actorUser.email}
            </Link>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        header: t`Mode`,
        cell: ({ row }) => <AdminRuleModeBadge mode={row.original.mode} />,
      },
      {
        header: t`Actions`,
        cell: ({ row }) =>
          row.original.actionsRun.length === 0 ? (
            <span className="text-muted-foreground">{t`None`}</span>
          ) : (
            <div className="flex max-w-[20rem] flex-wrap gap-1 whitespace-normal">
              {row.original.actionsRun.map((actionRun, index) => (
                <Badge
                  key={index}
                  variant={ACTION_RUN_STATUS_BADGE_VARIANT[actionRun.status]}
                  size="small"
                  title={actionRun.error}
                >
                  {t(ADMIN_RULE_ACTION_MAP[actionRun.type])}
                  {actionRun.status !== 'ran' && (
                    <span className="ml-1 opacity-70">({t(ADMIN_RULE_ACTION_RUN_STATUS_MAP[actionRun.status])})</span>
                  )}
                </Badge>
              ))}
            </div>
          ),
      },
    ] satisfies DataTableColumnDef<TFindAdminRuleMatchesResponse['data'][number]>[];
  }, [i18n.locale, showRule]);

  return (
    <DataTable
      columns={columns}
      data={results.data}
      perPage={results.perPage}
      currentPage={results.currentPage}
      totalPages={results.totalPages}
      onPaginationChange={onPaginationChange}
      hasFilters={hasFilters}
      onClearFilters={onClearFilters}
      error={{
        enable: isLoadingError,
      }}
      skeleton={{
        enable: isLoading,
        rows: 3,
        component: (
          <>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            {showRule && (
              <>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24 rounded-full" />
                </TableCell>
              </>
            )}
            <TableCell>
              <Skeleton className="h-4 w-36" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-28 rounded-full" />
            </TableCell>
          </>
        ),
      }}
    >
      {(table) => results.totalPages > 1 && <DataTablePagination additionalInformation="VisibleCount" table={table} />}
    </DataTable>
  );
};

const ACTION_RUN_STATUS_BADGE_VARIANT = {
  ran: 'default',
  would_run: 'secondary',
  failed: 'destructive',
  skipped: 'neutral',
} as const satisfies Record<TAdminRuleActionRunStatus, string>;
