import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { generateDatabaseId, nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

import { apiSignin, WEBAPP_ORIGIN_HEADERS } from '../../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test('[ADMIN][TRPC][RULES]: non-admins are rejected by every rule and tag route', async ({ page }) => {
  const { user } = await seedUser();

  const lastRule = await prisma.adminRule.findFirst({
    orderBy: {
      priority: 'desc',
    },
    select: {
      priority: true,
    },
  });

  // Rules are global. This one is disabled, so it never runs against events from other tests.
  const rule = await prisma.adminRule.create({
    data: {
      id: generateDatabaseId('admin_rule'),
      name: `Rule ${nanoid()}`,
      trigger: 'USER_NAME_CHANGED',
      mode: 'DISABLED',
      priority: (lastRule?.priority ?? -1) + 1,
      stopOnMatch: true,
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

  const tag = await prisma.adminTag.create({
    data: {
      id: generateDatabaseId('admin_tag'),
      type: 'flagged_for_review',
      description: 'Needs a look',
      userId: user.id,
    },
  });

  const createdRuleName = `Rule ${nanoid()}`;

  const queries = [
    ['admin.rule.get', { ruleId: rule.id }],
    ['admin.rule.getMany', undefined],
    ['admin.rule.matches.find', { ruleId: rule.id }],
    ['admin.tag.getMany', { userId: user.id }],
  ] as const;

  const mutations = [
    [
      'admin.rule.create',
      {
        name: createdRuleName,
        description: null,
        trigger: rule.trigger,
        mode: 'DISABLED',
        stopOnMatch: true,
        definition: rule.definition,
        exemptOrganisationIds: [],
      },
    ],
    ['admin.rule.update', { ruleId: rule.id, data: { name: createdRuleName } }],
    ['admin.rule.delete', { ruleId: rule.id }],
    ['admin.rule.reorder', { ruleIds: [rule.id] }],
    ['admin.tag.create', { userId: user.id, type: 'flagged_for_review', description: 'Added by a non-admin' }],
    ['admin.tag.delete', { tagId: tag.id }],
  ] as const;

  try {
    await apiSignin({ page, email: user.email });

    for (const [route, input] of queries) {
      const query = input === undefined ? '' : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;

      const res = await page.context().request.get(`${WEBAPP_BASE_URL}/api/trpc/${route}${query}`);

      expect(res.status(), route).toBe(401);
    }

    for (const [route, input] of mutations) {
      const res = await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/${route}`, {
        headers: { ...WEBAPP_ORIGIN_HEADERS, 'content-type': 'application/json' },
        data: JSON.stringify({ json: input }),
      });

      expect(res.status(), route).toBe(401);
    }

    // None of the calls changed anything.
    const unchangedRule = await prisma.adminRule.findFirstOrThrow({
      where: {
        id: rule.id,
      },
    });

    expect(unchangedRule.name).toEqual(rule.name);

    const createdRuleCount = await prisma.adminRule.count({
      where: {
        name: createdRuleName,
      },
    });

    expect(createdRuleCount).toEqual(0);

    const tags = await prisma.adminTag.findMany({
      where: {
        userId: user.id,
      },
    });

    expect(tags.map(({ id }) => id)).toEqual([tag.id]);
  } finally {
    await prisma.adminRule.deleteMany({
      where: {
        id: rule.id,
      },
    });
  }
});
