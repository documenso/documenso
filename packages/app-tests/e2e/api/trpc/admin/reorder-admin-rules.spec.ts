import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { generateDatabaseId, nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';

import { apiSignin, WEBAPP_ORIGIN_HEADERS } from '../../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

// Rules are global. These are disabled, so they never run against events from other tests.
const seedDisabledRule = async () => {
  const lastRule = await prisma.adminRule.findFirst({
    orderBy: {
      priority: 'desc',
    },
    select: {
      priority: true,
    },
  });

  return await prisma.adminRule.create({
    data: {
      id: generateDatabaseId('admin_rule'),
      name: `Rule ${nanoid()}`,
      trigger: 'USER_NAME_CHANGED',
      mode: 'DISABLED',
      priority: (lastRule?.priority ?? -1) + 1,
      stopOnMatch: false,
      definition: {
        when: {
          type: 'group',
          match: 'all',
          children: [
            {
              type: 'condition',
              field: 'user.new_name',
              operator: 'contains',
              value: 'x',
            },
          ],
        },
        actions: [
          {
            type: 'log_only',
            params: {},
          },
        ],
      },
    },
  });
};

const deleteRules = async (ruleIds: string[]) => {
  await prisma.adminRule.deleteMany({
    where: {
      id: {
        in: ruleIds,
      },
    },
  });
};

// Every rule id, in the order the engine runs them.
const findAllRuleIds = async () => {
  const rules = await prisma.adminRule.findMany({
    orderBy: [
      {
        priority: 'asc',
      },
      {
        createdAt: 'asc',
      },
      {
        id: 'asc',
      },
    ],
    select: {
      id: true,
    },
  });

  return rules.map(({ id }) => id);
};

const reorderRules = async (page: Page, ruleIds: string[]) =>
  await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/admin.rule.reorder`, {
    headers: { ...WEBAPP_ORIGIN_HEADERS, 'content-type': 'application/json' },
    data: JSON.stringify({ json: { ruleIds } }),
  });

test('[ADMIN][TRPC][REORDER_RULES]: rules are saved in the order given', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const firstRule = await seedDisabledRule();
  const secondRule = await seedDisabledRule();

  try {
    await apiSignin({ page, email: adminUser.email });

    // Every rule has to be included, and other tests add and remove rules meanwhile, so retry
    // until the full list goes through.
    await expect(async () => {
      const otherRuleIds = (await findAllRuleIds()).filter((id) => id !== firstRule.id && id !== secondRule.id);

      // Move the two rules to the top, the second one first.
      const res = await reorderRules(page, [secondRule.id, firstRule.id, ...otherRuleIds]);

      expect(res.status()).toBe(200);
    }).toPass({ timeout: 15_000 });

    const ruleIds = await findAllRuleIds();

    expect(ruleIds.indexOf(secondRule.id)).toBeLessThan(ruleIds.indexOf(firstRule.id));
  } finally {
    await deleteRules([firstRule.id, secondRule.id]);
  }
});

test('[ADMIN][TRPC][REORDER_RULES]: an unknown rule id is rejected with 400', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const rule = await seedDisabledRule();

  try {
    // Every rule but one, which is swapped for an id that doesn't exist, so only the id is wrong.
    const ruleIds = (await findAllRuleIds()).map((id) => (id === rule.id ? generateDatabaseId('admin_rule') : id));

    await apiSignin({ page, email: adminUser.email });

    const res = await reorderRules(page, ruleIds);

    expect(res.status()).toBe(400);

    const { error } = await res.json();

    expect(error.json.data.code).toEqual('INVALID_REQUEST');
  } finally {
    await deleteRules([rule.id]);
  }
});

test('[ADMIN][TRPC][REORDER_RULES]: a list that leaves out or repeats a rule is rejected with 400', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const firstRule = await seedDisabledRule();
  const secondRule = await seedDisabledRule();

  try {
    const ruleIds = await findAllRuleIds();

    const withoutFirstRule = ruleIds.filter((id) => id !== firstRule.id);

    // The same length as the full list, with the first rule in place of the second.
    const withFirstRuleTwice = ruleIds.map((id) => (id === secondRule.id ? firstRule.id : id));

    await apiSignin({ page, email: adminUser.email });

    for (const invalidRuleIds of [withoutFirstRule, withFirstRuleTwice]) {
      const res = await reorderRules(page, invalidRuleIds);

      expect(res.status()).toBe(400);

      const { error } = await res.json();

      expect(error.json.data.code).toEqual('INVALID_REQUEST');
    }
  } finally {
    await deleteRules([firstRule.id, secondRule.id]);
  }
});
