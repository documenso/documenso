// credits: https://github.com/calcom/cal.com/blob/main/apps/web/playwright/fixtures/users.ts
import { Page, WorkerInfo } from '@playwright/test';

import { APP_BASE_URL } from '@documenso/lib/constants/app';
import { createUser as createUser_ } from '@documenso/lib/server-only/user/create-user';
import { prisma } from '@documenso/prisma';

type TUser = Awaited<ReturnType<typeof createUser>>;

type TUserFixture = ReturnType<typeof createUserFixture>;

interface loginUsingApiParams {
  page: Page;
  user: TUser;
}

export async function apiLogin({ page, user: { email, name } }: loginUsingApiParams) {
  const password = name;
  const csrfToken = await page
    .context()
    .request.get('/api/auth/csrf')
    .then(async (response) => response.json())
    .then((json) => json.csrfToken);
  const data = {
    email,
    password,
    callbackURL: APP_BASE_URL,
    redirect: 'false',
    json: 'true',
    csrfToken,
  };
  return page.context().request.post('/api/auth/callback/credentials', {
    data,
  });
}

const createUserFixture = (user: TUser, page: Page) => {
  const store = { user, page };

  // self is a reflective method that return the Prisma object that references this fixture.
  const self = async () =>
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    (await prisma.user.findUnique({
      where: { id: store.user.id },
    }))!;
  return {
    id: user.id,
    email: user.email,
    name: user.name as string,
    apiLogin: async () => apiLogin({ user: { ...(await self()) }, page }),
  };
};

export const createUsersFixture = (page: Page, workerInfo: WorkerInfo) => {
  const store = { users: [], page } as { users: TUserFixture[]; page: Page };

  return {
    create: async () => {
      const _user = await createUser(workerInfo);
      const userFixture = createUserFixture(_user, store.page);
      store.users.push(userFixture);
      return userFixture;
    },
    get: () => store.users,
    delete: async (id: number) => {
      await prisma.user.delete({ where: { id } });
      store.users = store.users.filter((b) => b.id !== id);
    },
    deleteAll: async () => {
      const ids = store.users.map((u) => u.id);
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
      store.users = [];
    },
  };
};

const createUser = (workerInfo: WorkerInfo) => {
  const name = `${workerInfo.workerIndex}-${Date.now()}`;
  const email = `${name}@example.com`;
  const password = name;

  return createUser_({ name, email, password });
};
