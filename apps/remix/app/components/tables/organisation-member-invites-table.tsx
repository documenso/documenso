import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { OrganisationMemberInviteStatus } from '@prisma/client';
import { History, MoreHorizontal, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { ORGANISATION_MEMBER_ROLE_MAP } from '@documenso/lib/constants/organisations-translations';
import { ZUrlSearchParamsSchema } from '@documenso/lib/types/search-params';
import { trpc } from '@documenso/trpc/react';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
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
import { useToast } from '@documenso/ui/primitives/use-toast';

export const OrganisationMemberInvitesTable = () => {
  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();
  const organisation = useCurrentOrganisation();

  const { _, i18n } = useLingui();
  const { toast } = useToast();

  const parsedSearchParams = ZUrlSearchParamsSchema.parse(Object.fromEntries(searchParams ?? []));

  const { data, isLoading, isLoadingError } = trpc.organisation.member.invite.find.useQuery(
    {
      organisationId: organisation.id,
      query: parsedSearchParams.query,
      page: parsedSearchParams.page,
      perPage: parsedSearchParams.perPage,
      status: OrganisationMemberInviteStatus.PENDING,
    },
    {
      placeholderData: (previousData) => previousData,
    },
  );

  const { mutateAsync: resendOrganisationMemberInvitation } =
    trpc.organisation.member.invite.resend.useMutation({
      onSuccess: () => {
        toast({
          title: _(msg`Success`),
          description: _(msg`Invitation has been resent`),
        });
      },
      onError: () => {
        toast({
          title: _(msg`Something went wrong`),
          description: _(msg`Unable to resend invitation. Please try again.`),
          variant: 'destructive',
        });
      },
    });

  const { mutateAsync: deleteOrganisationMemberInvitations } =
    trpc.organisation.member.invite.deleteMany.useMutation({
      onSuccess: () => {
        toast({
          title: _(msg`Success`),
          description: _(msg`Invitation has been deleted`),
        });
      },
      onError: () => {
        toast({
          title: _(msg`Something went wrong`),
          description: _(msg`Unable to delete invitation. Please try again.`),
          variant: 'destructive',
        });
      },
    });

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
        header: _(msg`Organisation Member`),
        cell: ({ row }) => {
          return (
            <AvatarWithText
              avatarClass="h-12 w-12"
              avatarFallback={row.original.email.slice(0, 1).toUpperCase()}
              primaryText={
                <span className="text-foreground/80 font-semibold">{row.original.email}</span>
              }
            />
          );
        },
      },
      {
        header: _(msg`Role`),
        accessorKey: 'role',
        cell: ({ row }) => _(ORGANISATION_MEMBER_ROLE_MAP[row.original.organisationRole]),
      },
      {
        header: _(msg`Invited At`),
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
      {
        header: _(msg`Actions`),
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <MoreHorizontal className="text-muted-foreground h-5 w-5" />
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-52" align="start" forceMount>
              <DropdownMenuLabel>
                <Trans>Actions</Trans>
              </DropdownMenuLabel>

              <DropdownMenuItem
                onClick={async () =>
                  resendOrganisationMemberInvitation({
                    organisationId: organisation.id,
                    invitationId: row.original.id,
                  })
                }
              >
                <History className="mr-2 h-4 w-4" />
                <Trans>Resend</Trans>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={async () =>
                  deleteOrganisationMemberInvitations({
                    organisationId: organisation.id,
                    invitationIds: [row.original.id],
                  })
                }
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <Trans>Remove</Trans>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, []);

  return (
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
        rows: 3,
        component: (
          <>
            <TableCell className="w-1/2 py-4 pr-4">
              <div className="flex w-full flex-row items-center">
                <Skeleton className="h-12 w-12 flex-shrink-0 rounded-full" />
                <Skeleton className="ml-2 h-4 w-1/3 max-w-[10rem]" />
              </div>
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-12 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-6 rounded-full" />
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
  );
};
