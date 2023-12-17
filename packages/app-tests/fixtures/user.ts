// credits: https://github.com/calcom/cal.com/blob/main/apps/web/playwright/fixtures/users.ts
import type { BrowserContext, Page, WorkerInfo } from '@playwright/test';

import { APP_BASE_URL } from '@documenso/lib/constants/app';
import type { CreateUserOptions as CreateUserOptions_ } from '@documenso/lib/server-only/user/create-user';
import { createUser as createUser_ } from '@documenso/lib/server-only/user/create-user';
import { prisma } from '@documenso/prisma';

type TUser = Awaited<ReturnType<typeof createUser>>;

type TUserFixture = ReturnType<typeof createUserFixture>;

type apiLoginParams = {
  page: Page;
  user: TUser;
};

type CreateUserOptions = Omit<CreateUserOptions_, 'name' | 'email' | 'password'>;

export async function apiLogin({ page, user: { email, name } }: apiLoginParams) {
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
    self,
  };
};

export const createUsersFixture = (page: Page, workerInfo: WorkerInfo, context: BrowserContext) => {
  const store: { users: TUserFixture[]; page: Page } = { users: [], page };

  return {
    create: async (opts?: CreateUserOptions) => {
      const _user = await createUser(workerInfo, opts);
      const userFixture = createUserFixture(_user, store.page);
      store.users.push(userFixture);
      return userFixture;
    },
    get: () => store.users,
    logout: async () => {
      await context.clearCookies();
      await page.goto('/signin');
      await page.waitForURL('/signin');
    },
    delete: async (id: number) => {
      await prisma.user.delete({ where: { id } });
      store.users = store.users.filter((b) => b.id !== id);
    },
    deleteAll: async () => {
      const ids = store.users.map((u) => u.id);

      await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});

      // eslint-disable-next-line require-atomic-updates
      store.users = [];
    },
  };
};

const createUser = async (workerInfo: WorkerInfo, opts?: CreateUserOptions) => {
  const name = `user-${workerInfo.workerIndex}-${Date.now()}`;
  const email = `${name}@example.com`;
  const password = name;

  return createUser_({
    name,
    email,
    password,
    emailVerified: new Date(),
    ...(opts && { ...opts }),
  });
};
