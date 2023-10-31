'use server';

import { findUsers } from '@documenso/lib/server-only/user/get-all-users';

export async function search(search: string, page: number, perPage: number) {
  const results = await findUsers({ username: search, email: search, page, perPage });

  return results;
}
