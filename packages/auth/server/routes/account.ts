import { Hono } from 'hono';
import superjson from 'superjson';

import { deleteAccountProvider } from '../lib/utils/delete-account-provider';
import { getAccounts } from '../lib/utils/get-accounts';

export const accountRoute = new Hono()
  /**
   * Get all linked accounts.
   */
  .get('/accounts', async (c) => {
    const accounts = await getAccounts(c);

    return c.json(superjson.serialize({ accounts }));
  })
  /**
   * Delete an account linking method.
   */
  .delete('/account/:accountId', async (c) => {
    const accountId = c.req.param('accountId');

    await deleteAccountProvider(c, accountId);

    return c.json({ success: true });
  });
