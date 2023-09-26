import { deleteUserAndItsData } from '@documenso/lib/server-only/user/delete-user-and-data';

async function teardown() {
  if (!process.env.E2E_TEST_USERNAME || !process.env.E2E_TEST_AUTHENTICATE_USERNAME) {
    return;
  }

  try {
    await deleteUserAndItsData(process.env.E2E_TEST_USERNAME);
    await deleteUserAndItsData(process.env.E2E_TEST_AUTHENTICATE_USERNAME);
  } catch (e) {
    throw new Error(`Error deleting user: ${e}`);
  }
}

export default teardown;
