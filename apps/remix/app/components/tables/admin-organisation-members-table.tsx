import { ORGANISATION_MEMBER_ROLE_MAP } from '@documenso/lib/constants/organisations-translations';
import { getHighestOrganisationRoleInGroup } from '@documenso/lib/utils/organisations';
import type { TGetAdminOrganisationResponse } from '@documenso/trpc/server/admin-router/get-admin-organisation.types';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { DataTable, type DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Input } from '@documenso/ui/primitives/input';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';
import { Trans, useLingui } from '@lingui/react/macro';
import { OrganisationMemberRole } from '@prisma/client';
import { MoreHorizontalIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { AdminOrganisationMemberDeleteDialog } from '~/components/dialogs/admin-organisation-member-delete-dialog';
import { AdminOrganisationMemberUpdateDialog } from '~/components/dialogs/admin-organisation-member-update-dialog';

type Member = TGetAdminOrganisationResponse['members'][number];

type AdminOrganisationMembersTableProps = {
  organisation: TGetAdminOrganisationResponse;
};

export const AdminOrganisationMembersTable = ({ organisation }: AdminOrganisationMembersTableProps) => {
  const { t, i18n } = useLingui();

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const isOwner = (member: Member) => member.userId === organisation.ownerUserId;

  const getRole = (member: Member) =>
    getHighestOrganisationRoleInGroup(member.organisationGroupMembers.map((groupMember) => groupMember.group));

  // The owner first, then admins, managers and members, each group by name.
  const getRank = (member: Member) => (isOwner(member) ? 0 : ROLE_RANK[getRole(member)]);

  const needle = query.trim().toLowerCase();

  const members = organisation.members
    .filter(
      (member) => member.user.email.toLowerCase().includes(needle) || member.user.name?.toLowerCase().includes(needle),
    )
    .sort((a, b) => getRank(a) - getRank(b) || getName(a).localeCompare(getName(b)));

  const totalPages = Math.max(1, Math.ceil(members.length / perPage));
  const currentPage = Math.min(page, totalPages);

  // Memoised so the cells keep their identity between renders. A re-render would otherwise
  // remount them and close an open popover or dialog.
  const columns = useMemo(() => {
    return [
      {
        header: t`Member`,
        cell: ({ row }) => (
          <div className="max-w-[340px]">
            <Link
              className="block truncate font-medium hover:underline"
              to={`/admin/users/${row.original.userId}`}
              title={getName(row.original)}
            >
              {getName(row.original)}
            </Link>
            {row.original.user.name && (
              <div className="truncate text-muted-foreground text-xs" title={row.original.user.email}>
                {row.original.user.email}
              </div>
            )}
          </div>
        ),
      },
      {
        header: t`User ID`,
        accessorKey: 'userId',
        cell: ({ row }) => <span className="font-mono text-muted-foreground text-xs">{row.original.userId}</span>,
      },
      {
        header: t`Role`,
        cell: ({ row }) => {
          if (isOwner(row.original)) {
            return <Badge size="small">{t`Owner`}</Badge>;
          }

          const role = getRole(row.original);

          // Plain members are the bulk of the list, so only the elevated roles carry a badge.
          if (role === OrganisationMemberRole.MEMBER) {
            return <span className="text-muted-foreground">{t(ORGANISATION_MEMBER_ROLE_MAP[role])}</span>;
          }

          return (
            <Badge variant="neutral" size="small">
              {t(ORGANISATION_MEMBER_ROLE_MAP[role])}
            </Badge>
          );
        },
      },
      {
        header: t`Joined`,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            {i18n.date(row.original.createdAt, { dateStyle: 'medium' })}
          </span>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label={t`Manage ${getName(row.original)}`}
                  className="relative h-8 w-8 p-0 text-muted-foreground before:absolute before:-inset-1"
                >
                  <MoreHorizontalIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>

              <PopoverContent align="end" className="flex w-48 flex-col gap-2 p-2">
                <AdminOrganisationMemberUpdateDialog
                  trigger={
                    <Button variant="outline">
                      <Trans>Update role</Trans>
                    </Button>
                  }
                  organisationId={organisation.id}
                  organisationMember={row.original}
                  isOwner={isOwner(row.original)}
                />

                {isOwner(row.original) ? (
                  <p className="px-1 text-muted-foreground text-xs">
                    <Trans>Transfer ownership before you remove the owner.</Trans>
                  </p>
                ) : (
                  <AdminOrganisationMemberDeleteDialog
                    organisationId={organisation.id}
                    organisationName={organisation.name}
                    organisationMemberId={row.original.id}
                    organisationMemberName={getName(row.original)}
                    organisationMemberEmail={row.original.user.email}
                  />
                )}
              </PopoverContent>
            </Popover>
          </div>
        ),
      },
    ] satisfies DataTableColumnDef<Member>[];
  }, [organisation, i18n, t]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder={t`Filter by name or email`}
          aria-label={t`Filter members by name or email`}
          className="h-9 w-64"
        />
      </div>

      <DataTable
        columns={columns}
        data={members.slice((currentPage - 1) * perPage, currentPage * perPage)}
        perPage={perPage}
        currentPage={currentPage}
        totalPages={totalPages}
        onPaginationChange={(nextPage, nextPerPage) => {
          setPage(nextPage);
          setPerPage(nextPerPage);
        }}
        hasFilters={query !== ''}
        onClearFilters={() => setQuery('')}
      >
        {(table) =>
          table.getPageCount() > 1 || perPage > 10 ? (
            <DataTablePagination additionalInformation="None" table={table} />
          ) : null
        }
      </DataTable>
    </div>
  );
};

const getName = (member: Member) => member.user.name || member.user.email;

const ROLE_RANK: Record<OrganisationMemberRole, number> = {
  [OrganisationMemberRole.ADMIN]: 1,
  [OrganisationMemberRole.MANAGER]: 2,
  [OrganisationMemberRole.MEMBER]: 3,
};
