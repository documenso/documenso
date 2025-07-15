import { useMemo } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';
import { EmailDomainStatus } from '@prisma/client';
import { CheckCircle2Icon, ClockIcon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { match } from 'ts-pattern';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { OrganisationEmailDomainDeleteDialog } from '../dialogs/organisation-email-domain-delete-dialog';

export const OrganisationEmailDomainsDataTable = () => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();
  const organisation = useCurrentOrganisation();

  const parsedSearchParams = ZUrlSearchParamsSchema.parse(Object.fromEntries(searchParams ?? []));

  const { mutate: verifyEmails, isPending: isVerifyingEmails } =
    trpc.enterprise.organisation.emailDomain.verify.useMutation({
      onSuccess: () => {
        toast({
          title: t`Email domains synced`,
          description: t`All email domains have been synced successfully`,
        });
      },
    });

  const { data, isLoading, isLoadingError } =
    trpc.enterprise.organisation.emailDomain.find.useQuery(
      {
        organisationId: organisation.id,
        query: parsedSearchParams.query,
        page: parsedSearchParams.page,
        perPage: parsedSearchParams.perPage,
      },
      {
        placeholderData: (previousData) => previousData,
      },
    );

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
        header: t`Domain`,
        accessorKey: 'domain',
      },
      {
        header: t`Status`,
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
        header: t`Emails`,
        accessorKey: 'emailCount',
        cell: ({ row }) => row.original.emailCount,
      },
      {
        header: t`Actions`,
        cell: ({ row }) => (
          <div className="flex justify-end space-x-2">
            <Button asChild variant="outline">
              <Link to={`/o/${organisation.url}/settings/email-domains/${row.original.id}`}>
                Manage
              </Link>
            </Button>

            <OrganisationEmailDomainDeleteDialog
              emailDomainId={row.original.id}
              emailDomain={row.original.domain}
              trigger={
                <Button variant="destructive" title={t`Remove email domain`}>
                  <Trans>Delete</Trans>
                </Button>
              }
            />
          </div>
        ),
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, []);

  return (
    <>
      <DataTable
        columns={columns}
        data={results.data}
        perPage={results.perPage}
        currentPage={results.currentPage}
        totalPages={results.totalPages}
        onPaginationChange={onPaginationChange}
        error={{
          enable: isLoadingError,
        }}
        skeleton={{
          enable: isLoading,
          rows: 1,
          component: (
            <>
              <TableCell>
                <Skeleton className="h-4 w-20 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-20 rounded" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-12 rounded-full" />
              </TableCell>
              <TableCell>
                <div className="flex flex-row justify-end space-x-2">
                  <Skeleton className="h-10 w-20 rounded" />
                  <Skeleton className="h-10 w-20 rounded" />
                </div>
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

      <AnimateGenericFadeInOut key={results.data.length}>
        {results.data.length > 0 && (
          <Alert
            className="mt-2 flex flex-col justify-between p-6 sm:flex-row sm:items-center"
            variant="neutral"
          >
            <div className="mb-4 sm:mb-0">
              <AlertTitle>
                <Trans>Sync Email Domains</Trans>
              </AlertTitle>

              <AlertDescription className="mr-2">
                <Trans>
                  This will check and sync the status of all email domains for this organisation
                </Trans>
              </AlertDescription>
            </div>

            <Button
              variant="outline"
              loading={isVerifyingEmails}
              onClick={() => {
                verifyEmails({
                  organisationId: organisation.id,
                });
              }}
            >
              <Trans>Sync</Trans>
            </Button>
          </Alert>
        )}
      </AnimateGenericFadeInOut>
    </>
  );
};
