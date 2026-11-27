import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { ADMIN_TAG_TYPE_MAP } from '@documenso/lib/constants/admin-tags-translations';
import { ZAdminTagTypeSchema } from '@documenso/lib/types/admin-tags';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import {
  type TAdminTagOrderByColumn,
  type TFindAdminTagsResponse,
  ZAdminTagOrderByColumnSchema,
  ZAdminTagOrderByDirectionSchema,
  ZAdminTagSourceSchema,
  ZAdminTagSubjectTypeSchema,
} from '@documenso/trpc/server/admin-router/tags/find-admin-tags.types';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { Input } from '@documenso/ui/primitives/input';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  Building2Icon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  LoaderIcon,
  MoreHorizontalIcon,
  PencilIcon,
  TagIcon,
  TargetIcon,
  Trash2Icon,
  UserCogIcon,
  UserIcon,
} from 'lucide-react';
import { DateTime } from 'luxon';
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { AdminTagDeleteDialog } from '~/components/dialogs/admin-tag-delete-dialog';
import { AdminTagUpdateDialog } from '~/components/dialogs/admin-tag-update-dialog';
import { AdminTagTypeBadge } from '~/components/general/admin-tag-type-badge';
import { FilterPill } from '~/components/general/filter-pill';

type AdminTag = TFindAdminTagsResponse['data'][number];

const DEFAULT_ORDER_BY_COLUMN = 'createdAt';
const DEFAULT_ORDER_BY_DIRECTION = 'desc';

export const AdminTagsTable = () => {
  const { t, i18n } = useLingui();

  // Literal parsers drop unknown values, so a hand-edited URL falls back to the defaults.
  const [searchParams, setSearchParams] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      type: parseAsStringLiteral(ZAdminTagTypeSchema.options),
      subjectType: parseAsStringLiteral(ZAdminTagSubjectTypeSchema.options),
      source: parseAsStringLiteral(ZAdminTagSourceSchema.options),
      orderByColumn: parseAsStringLiteral(ZAdminTagOrderByColumnSchema.options),
      orderByDirection: parseAsStringLiteral(ZAdminTagOrderByDirectionSchema.options),
      page: parseAsInteger,
      perPage: parseAsInteger,
    },
    {
      history: 'push',
    },
  );

  const debouncedQuery = useDebouncedValue(searchParams.query, 500);

  const { page, perPage } = ZUrlSearchParamsSchema.parse({
    page: searchParams.page ?? undefined,
    perPage: searchParams.perPage ?? undefined,
  });

  const orderByColumn = searchParams.orderByColumn ?? DEFAULT_ORDER_BY_COLUMN;
  const orderByDirection = searchParams.orderByDirection ?? DEFAULT_ORDER_BY_DIRECTION;

  const { data, isLoading, isLoadingError, isPlaceholderData } = trpc.admin.tag.find.useQuery(
    {
      query: debouncedQuery || undefined,
      type: searchParams.type ?? undefined,
      subjectType: searchParams.subjectType ?? undefined,
      source: searchParams.source ?? undefined,
      orderByColumn,
      orderByDirection,
      page,
      perPage,
    },
    {
      placeholderData: (previousData) => previousData,
    },
  );

  const results = data ?? {
    data: [],
    perPage: 20,
    currentPage: 1,
    totalPages: 1,
  };

  // Removing the only tag on the last page leaves the URL past the end, so step back to the new last page.
  useEffect(() => {
    if (!data || isPlaceholderData) {
      return;
    }

    const lastPage = Math.max(data.totalPages, 1);

    if (data.currentPage <= lastPage) {
      return;
    }

    void setSearchParams(
      {
        page: lastPage === 1 ? null : lastPage,
      },
      {
        history: 'replace',
      },
    );
  }, [data, isPlaceholderData]);

  const hasFilters =
    searchParams.query !== '' ||
    searchParams.type !== null ||
    searchParams.subjectType !== null ||
    searchParams.source !== null;

  const onSearchChange = (value: string) => {
    // Replace so typing doesn't add a history entry per keystroke, and reset
    // pagination so a new search never lands on an empty page.
    void setSearchParams(
      {
        query: value,
        page: null,
      },
      {
        history: 'replace',
      },
    );
  };

  const onClearFilters = () => {
    void setSearchParams({
      query: '',
      type: null,
      subjectType: null,
      source: null,
      page: null,
    });
  };

  const onPaginationChange = (newPage: number, newPerPage: number) => {
    void setSearchParams({
      page: newPage,
      perPage: newPerPage,
    });
  };

  const onSortChange = (column: TAdminTagOrderByColumn) => {
    const direction = column === orderByColumn && orderByDirection === 'desc' ? 'asc' : 'desc';

    const isDefaultSort = column === DEFAULT_ORDER_BY_COLUMN && direction === DEFAULT_ORDER_BY_DIRECTION;

    void setSearchParams({
      orderByColumn: isDefaultSort ? null : column,
      orderByDirection: isDefaultSort ? null : direction,
      page: null,
    });
  };

  const columns = useMemo(() => {
    const formatRelative = (date: Date) => DateTime.fromJSDate(date).setLocale(i18n.locale).toRelative();
    const formatFull = (date: Date) => i18n.date(date, { dateStyle: 'medium', timeStyle: 'short' });

    const sortableHeader = (label: string, column: TAdminTagOrderByColumn) => {
      const isActive = column === orderByColumn;

      const SortIcon = !isActive ? ChevronsUpDownIcon : orderByDirection === 'asc' ? ChevronUpIcon : ChevronDownIcon;

      return (
        <button
          type="button"
          className="-ml-1 flex items-center gap-1 whitespace-nowrap rounded px-1 hover:text-foreground"
          onClick={() => onSortChange(column)}
        >
          {label}
          <SortIcon className={isActive ? 'h-4 w-4 text-foreground' : 'h-4 w-4 opacity-50'} />
        </button>
      );
    };

    return [
      {
        header: t`Tag`,
        cell: ({ row }) => (
          <div className="min-w-[12rem] max-w-[28rem] space-y-1 whitespace-normal">
            <AdminTagTypeBadge type={row.original.type} />

            <p
              data-testid="admin-tag-description"
              className="line-clamp-2 [overflow-wrap:anywhere]"
              title={row.original.description}
            >
              {row.original.description}
            </p>
          </div>
        ),
      },
      {
        header: t`Applies to`,
        cell: ({ row }) => <AdminTagSubjectCell tag={row.original} />,
      },
      {
        header: t`Added by`,
        cell: ({ row }) => <AdminTagSourceCell tag={row.original} />,
      },
      {
        id: 'createdAt',
        header: () => sortableHeader(t`Created`, 'createdAt'),
        cell: ({ row }) => (
          <time
            className="whitespace-nowrap text-muted-foreground"
            dateTime={row.original.createdAt.toISOString()}
            title={formatFull(row.original.createdAt)}
          >
            {formatRelative(row.original.createdAt)}
          </time>
        ),
      },
      {
        id: 'updatedAt',
        header: () => sortableHeader(t`Updated`, 'updatedAt'),
        cell: ({ row }) => (
          <time
            className="whitespace-nowrap text-muted-foreground"
            dateTime={row.original.updatedAt.toISOString()}
            title={formatFull(row.original.updatedAt)}
          >
            {formatRelative(row.original.updatedAt)}
          </time>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => <AdminTagRowActions tag={row.original} />,
      },
    ] satisfies DataTableColumnDef<AdminTag>[];
  }, [i18n.locale, orderByColumn, orderByDirection]);

  return (
    <div>
      <div className="my-6 flex flex-col gap-3">
        <Input
          type="search"
          placeholder={t`Search by description, user or organisation`}
          value={searchParams.query}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        <div className="flex flex-wrap items-center gap-2">
          <FilterPill
            icon={TagIcon}
            label={<Trans>Tag</Trans>}
            value={searchParams.type}
            onChange={(value) =>
              void setSearchParams({
                type: ZAdminTagTypeSchema.nullable().catch(null).parse(value),
                page: null,
              })
            }
            options={ZAdminTagTypeSchema.options.map((type) => ({
              value: type,
              label: t(ADMIN_TAG_TYPE_MAP[type]),
            }))}
          />

          <FilterPill
            icon={TargetIcon}
            label={<Trans>Applies to</Trans>}
            value={searchParams.subjectType}
            onChange={(value) =>
              void setSearchParams({
                subjectType: ZAdminTagSubjectTypeSchema.nullable().catch(null).parse(value),
                page: null,
              })
            }
            options={[
              {
                value: 'user',
                label: t`Users`,
              },
              {
                value: 'organisation',
                label: t`Organisations`,
              },
            ]}
          />

          <FilterPill
            icon={UserCogIcon}
            label={<Trans>Added by</Trans>}
            value={searchParams.source}
            onChange={(value) =>
              void setSearchParams({
                source: ZAdminTagSourceSchema.nullable().catch(null).parse(value),
                page: null,
              })
            }
            options={[
              {
                value: 'admin',
                label: t`An admin`,
              },
              {
                value: 'rule',
                label: t`A rule`,
              },
            ]}
          />
        </div>
      </div>

      <div className="relative">
        <DataTable
          columns={columns}
          data={results.data}
          getRowId={(row) => row.id}
          rowClassName="text-sm"
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
                  <Skeleton className="h-5 w-28 rounded-md" />
                  <Skeleton className="mt-2 h-4 w-56 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-40 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-5 rounded" />
                </TableCell>
              </>
            ),
          }}
        >
          {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
        </DataTable>

        {isPlaceholderData && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <LoaderIcon className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
};

type AdminTagCellProps = {
  tag: AdminTag;
};

/**
 * The dialogs sit outside the menu so picking an item closes the menu instead of leaving it open
 * behind the dialog.
 */
const AdminTagRowActions = ({ tag }: AdminTagCellProps) => {
  const { t } = useLingui();

  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={t`Actions`}>
          <MoreHorizontalIcon className="h-5 w-5 text-muted-foreground" />
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-44" align="end">
          <DropdownMenuItem onClick={() => setIsUpdateDialogOpen(true)}>
            <PencilIcon className="mr-2 h-4 w-4" />
            <Trans>Edit</Trans>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)}>
            <Trash2Icon className="mr-2 h-4 w-4" />
            <Trans>Remove</Trans>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AdminTagUpdateDialog tag={tag} open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen} />

      <AdminTagDeleteDialog tag={tag} open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} />
    </>
  );
};

const AdminTagSubjectCell = ({ tag }: AdminTagCellProps) => {
  if (tag.user) {
    return (
      <Link to={`/admin/users/${tag.user.id}`} className="flex max-w-[13rem] items-center gap-2 hover:underline">
        <UserIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">
          <Trans>User</Trans>
        </span>
        <span className="truncate">{tag.user.email}</span>
      </Link>
    );
  }

  if (tag.organisation) {
    return (
      <Link
        to={`/admin/organisations/${tag.organisation.id}`}
        className="flex max-w-[13rem] items-center gap-2 hover:underline"
      >
        <Building2Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">
          <Trans>Organisation</Trans>
        </span>
        <span className="truncate">{tag.organisation.name}</span>
      </Link>
    );
  }

  return <span className="text-muted-foreground">-</span>;
};

const AdminTagSourceCell = ({ tag }: AdminTagCellProps) => {
  if (tag.adminRule) {
    const ruleName = tag.adminRule.name;

    return (
      <Link
        to={`/admin/rules/${tag.adminRule.id}`}
        className="block max-w-[11rem] truncate hover:underline"
        title={ruleName}
      >
        <Trans>Rule: {ruleName}</Trans>
      </Link>
    );
  }

  if (tag.createdByUser) {
    return (
      <span className="block max-w-[11rem] truncate" title={tag.createdByUser.email}>
        {tag.createdByUser.email}
      </span>
    );
  }

  return (
    <span className="text-muted-foreground">
      <Trans>Deleted user or rule</Trans>
    </span>
  );
};
