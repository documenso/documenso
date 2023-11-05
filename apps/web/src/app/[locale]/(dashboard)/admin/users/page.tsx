import { UsersDataTable } from './data-table-users';
import { search } from './fetch-users.actions';

type AdminManageUsersProps = {
  searchParams?: {
    search?: string;
    page?: number;
    perPage?: number;
  };
};

export default async function AdminManageUsers({ searchParams = {} }: AdminManageUsersProps) {
  const page = Number(searchParams.page) || 1;
  const perPage = Number(searchParams.perPage) || 10;
  const searchString = searchParams.search || '';

  const { users, totalPages } = await search(searchString, page, perPage);

  return (
    <div>
      <h2 className="text-4xl font-semibold">Manage users</h2>
      <UsersDataTable users={users} totalPages={totalPages} page={page} perPage={perPage} />
    </div>
  );
}
