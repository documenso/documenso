import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({ mode: 'parallel' });

test('[ADMIN][TRPC][FIND_USERS]: non-admin user is rejected with 401', async ({ page }) => {
  const { user: nonAdminUser } = await seedUser({ isAdmin: false });

  await apiSignin({ page, email: nonAdminUser.email });

  const inputParam = encodeURIComponent(JSON.stringify({ json: { role: 'ADMIN' } }));

  const res = await page.context().request.get(`${WEBAPP_BASE_URL}/api/trpc/admin.user.find?input=${inputParam}`);

  expect(res.status()).toBe(401);
});
