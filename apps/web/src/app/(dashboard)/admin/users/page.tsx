import { findUsers } from '@documenso/lib/server-only/user/get-all-users';

import { Users } from './users';

type AdminManageUsersProps = {
  searchParams?: {
    page?: number;
    perPage?: number;
  };
};

export default function AdminManageUsers({ searchParams = {} }: AdminManageUsersProps) {
  const page = Number(searchParams.page) || 1;
  const perPage = Number(searchParams.perPage) || 10;

  async function search(search: string) {
    'use server';

    const results = await findUsers({ username: search, email: search, page, perPage });

    return results;
  }

  return (
    <div>
      <h2 className="text-4xl font-semibold">Manage users</h2>
      <Users search={search} page={page} perPage={perPage} />
    </div>
  );
}
