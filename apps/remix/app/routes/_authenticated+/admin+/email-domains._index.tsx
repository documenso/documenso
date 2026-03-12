import { useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { EmailDomainStatus } from '@prisma/client';
import { CheckCircle2Icon, ClockIcon, Loader } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { match } from 'ts-pattern';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { trpc } from '@documenso/trpc/react';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Input } from '@documenso/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

export default function AdminEmailDomainsPage() {
  const { _, i18n } = useLingui();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const [term, setTerm] = useState(() => searchParams?.get?.('term') ?? '');
  const debouncedTerm = useDebouncedValue(term, 500);

  const page = searchParams?.get?.('page') ? Number(searchParams.get('page')) : undefined;
  const perPage = searchParams?.get?.('perPage') ? Number(searchParams.get('perPage')) : undefined;
  const statusParam = searchParams?.get?.('status') ?? 'ALL';

  const statusFilter =
    statusParam === 'PENDING' || statusParam === 'ACTIVE' ? statusParam : undefined;

  const { data: findEmailDomainsData, isPending: isFindEmailDomainsLoading } =
    trpc.admin.emailDomain.find.useQuery(
      {
        query: debouncedTerm,
        page: page || 1,
        perPage: perPage || 20,
        status: statusFilter,
      },
      {
        placeholderData: (previousData) => previousData,
      },
    );

  const results = findEmailDomainsData ?? {
    data: [],
    perPage: 20,
    currentPage: 1,
    totalPages: 1,
  };

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Domain`),
        accessorKey: 'domain',
        cell: ({ row }) => (
          <Link
            to={`/admin/email-domains/${row.original.id}`}
            className="block max-w-[10rem] truncate font-medium hover:underline md:max-w-[15rem]"
          >
            {row.original.domain}
          </Link>
        ),
      },
      {
        header: _(msg`Organisation`),
        accessorKey: 'organisation',
        cell: ({ row }) => (
          <Link
            to={`/admin/organisations/${row.original.organisation.id}`}
            className="hover:underline"
          >
            {row.original.organisation.name}
          </Link>
        ),
      },
      {
        header: _(msg`Status`),
        accessorKey: 'status',
        cell: ({ row }) =>
          match(row.original.status)
            .with(EmailDomainStatus.ACTIVE, () => (
              <Badge>
                <CheckCircle2Icon className="mr-2 h-4 w-4 text-green-500 dark:text-green-300" />
                <Trans>Active</Trans>
              </Badge>
            ))
            .with(EmailDomainStatus.PENDING, () => (
              <Badge variant="warning">
                <ClockIcon className="mr-2 h-4 w-4 text-yellow-500 dark:text-yellow-200" />
                <Trans>Pending</Trans>
              </Badge>
            ))
            .exhaustive(),
      },
      {
        header: _(msg`Emails`),
        accessorKey: '_count',
        cell: ({ row }) => row.original._count.emails,
      },
      {
        header: _(msg`Created`),
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
      {
        header: _(msg`Last Verified`),
        accessorKey: 'lastVerifiedAt',
        cell: ({ row }) =>
          row.original.lastVerifiedAt ? i18n.date(row.original.lastVerifiedAt) : '-',
      },
      {
        header: _(msg`Actions`),
        cell: ({ row }) => (
          <Button asChild variant="outline" size="sm">
            <Link to={`/admin/email-domains/${row.original.id}`}>
              <Trans>View</Trans>
            </Link>
          </Button>
        ),
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, []);

  const onPaginationChange = (newPage: number, newPerPage: number) => {
    updateSearchParams({
      page: newPage,
      perPage: newPerPage,
    });
  };

  const onStatusChange = (value: string) => {
    updateSearchParams({
      status: value === 'ALL' ? undefined : value,
      page: 1,
    });
  };

  return (
    <div>
      <h2 className="text-4xl font-semibold">
        <Trans>Email Domains</Trans>
      </h2>

      <div className="mt-8">
        <div className="flex flex-col gap-4 sm:flex-row">
          <Input
            className="flex-1"
            type="search"
            placeholder={_(msg`Search by domain or organisation name`)}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />

          <Select value={statusParam} onValueChange={onStatusChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={_(msg`Filter by status`)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">
                <Trans>All Statuses</Trans>
              </SelectItem>
              <SelectItem value="PENDING">
                <Trans>Pending</Trans>
              </SelectItem>
              <SelectItem value="ACTIVE">
                <Trans>Active</Trans>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative mt-4">
          <DataTable
            columns={columns}
            data={results.data}
            perPage={results.perPage ?? 20}
            currentPage={results.currentPage ?? 1}
            totalPages={results.totalPages ?? 1}
            onPaginationChange={onPaginationChange}
          >
            {(table) => <DataTablePagination additionalInformation="VisibleCount" table={table} />}
          </DataTable>

          {isFindEmailDomainsLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50">
              <Loader className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
