import { UsersDataTable } from './data-table-users';

type AdminManageUsersProps = {
  searchParams?: {
    page?: number;
    perPage?: number;
  };
};

export default function AdminManageUsers({ searchParams = {} }: AdminManageUsersProps) {
  const page = Number(searchParams.page) || 1;
  const perPage = Number(searchParams.perPage) || 10;

  return (
    <div>
      <h2 className="text-4xl font-semibold">Manage users</h2>
      <UsersDataTable page={page} perPage={perPage} />
    </div>
  );
}
