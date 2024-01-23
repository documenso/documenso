'use server';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { isAdmin } from '@documenso/lib/next-auth/guards/is-admin';
import { findUsers } from '@documenso/lib/server-only/user/get-all-users';

export async function search(search: string, page: number, perPage: number) {
  const { user } = await getRequiredServerComponentSession();

  if (!isAdmin(user)) {
    throw new Error('Unauthorized');
  }

  const results = await findUsers({ username: search, email: search, page, perPage });

  return results;
}
