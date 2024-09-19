'use server';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { isAdmin } from '@documenso/lib/next-auth/guards/is-admin';
import { getSigningVolume } from '@documenso/lib/server-only/admin/get-signing-volume';

export async function search(search: string, page: number, perPage: number) {
  const { user } = await getRequiredServerComponentSession();

  if (!isAdmin(user)) {
    throw new Error('Unauthorized');
  }

  const results = await getSigningVolume({ search, page, perPage });

  return results;
}
