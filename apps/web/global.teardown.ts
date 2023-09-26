import { deleteUser } from '@documenso/lib/server-only/user/delete-user';

async function teardown() {
  if (!process.env.E2E_TEST_USERNAME) {
    return;
  }

  try {
    await deleteUser(process.env.E2E_TEST_USERNAME);
  } catch (e) {
    throw new Error(`Error deleting user: ${e}`);
  }
}

export default teardown;
