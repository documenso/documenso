import { findUsers } from '@documenso/lib/server-only/user/get-all-users';

/*
1. retrieve all users from the db
2. display them in a table
*/
import { UsersDataTable } from './data-table-users';

type AdminManageUsersProps = {
  searchParams?: {
    page?: number;
    perPage?: number;
  };
};

export default async function AdminManageUsers({ searchParams = {} }: AdminManageUsersProps) {
  const page = Number(searchParams.page) || 1;
  const perPage = Number(searchParams.perPage) || 10;

  const results = await findUsers({ page, perPage });

  return (
    <div>
      <h2 className="text-4xl font-semibold">Manage users</h2>
      <div className="mt-8">
        <UsersDataTable
          users={results.users}
          perPage={perPage}
          page={page}
          totalPages={results.totalPages}
        />
      </div>
    </div>
  );
}
