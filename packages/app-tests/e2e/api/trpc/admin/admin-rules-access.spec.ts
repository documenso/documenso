import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { generateDatabaseId, nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { type APIRequestContext, expect, test } from '@playwright/test';

import { apiSignin, WEBAPP_ORIGIN_HEADERS } from '../../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

const ruleIdsToCleanup: string[] = [];

test.afterEach(async () => {
  await prisma.adminRule.deleteMany({
    where: {
      id: {
        in: ruleIdsToCleanup,
      },
    },
  });

  ruleIdsToCleanup.length = 0;
});

test('[ADMIN][TRPC][RULES]: signed out users are rejected by every rule and tag route', async ({ request }) => {
  const { user, rule, tag, createdRuleName } = await seedRuleAndTag();

  await expectQueryUnauthorized(request, 'admin.rule.get', { ruleId: rule.id });
  await expectQueryUnauthorized(request, 'admin.rule.getMany');
  await expectQueryUnauthorized(request, 'admin.rule.matches.find', { ruleId: rule.id });
  await expectQueryUnauthorized(request, 'admin.tag.getMany', { userId: user.id });

  await expectMutationUnauthorized(request, 'admin.rule.create', {
    name: createdRuleName,
    description: null,
    trigger: rule.trigger,
    mode: 'DISABLED',
    stopOnMatch: true,
    definition: rule.definition,
    exemptOrganisationIds: [],
  });
  await expectMutationUnauthorized(request, 'admin.rule.update', { ruleId: rule.id, data: { name: createdRuleName } });
  await expectMutationUnauthorized(request, 'admin.rule.delete', { ruleId: rule.id });
  await expectMutationUnauthorized(request, 'admin.rule.reorder', { ruleIds: [rule.id] });
  await expectMutationUnauthorized(request, 'admin.tag.create', {
    userId: user.id,
    type: 'flagged_for_review',
    description: 'Added by a signed out user',
  });
  await expectMutationUnauthorized(request, 'admin.tag.delete', { tagId: tag.id });

  await expectNothingChanged({ user, rule, tag, createdRuleName });
});

test('[ADMIN][TRPC][RULES]: non-admins are rejected by every rule and tag route', async ({ page }) => {
  const { user, rule, tag, createdRuleName } = await seedRuleAndTag();

  await apiSignin({ page, email: user.email });

  const request = page.context().request;

  await expectQueryUnauthorized(request, 'admin.rule.get', { ruleId: rule.id });
  await expectQueryUnauthorized(request, 'admin.rule.getMany');
  await expectQueryUnauthorized(request, 'admin.rule.matches.find', { ruleId: rule.id });
  await expectQueryUnauthorized(request, 'admin.tag.getMany', { userId: user.id });

  await expectMutationUnauthorized(request, 'admin.rule.create', {
    name: createdRuleName,
    description: null,
    trigger: rule.trigger,
    mode: 'DISABLED',
    stopOnMatch: true,
    definition: rule.definition,
    exemptOrganisationIds: [],
  });
  await expectMutationUnauthorized(request, 'admin.rule.update', { ruleId: rule.id, data: { name: createdRuleName } });
  await expectMutationUnauthorized(request, 'admin.rule.delete', { ruleId: rule.id });
  await expectMutationUnauthorized(request, 'admin.rule.reorder', { ruleIds: [rule.id] });
  await expectMutationUnauthorized(request, 'admin.tag.create', {
    userId: user.id,
    type: 'flagged_for_review',
    description: 'Added by a non-admin',
  });
  await expectMutationUnauthorized(request, 'admin.tag.delete', { tagId: tag.id });

  await expectNothingChanged({ user, rule, tag, createdRuleName });
});

const seedRuleAndTag = async () => {
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

  ruleIdsToCleanup.push(rule.id);

  const tag = await prisma.adminTag.create({
    data: {
      id: generateDatabaseId('admin_tag'),
      type: 'flagged_for_review',
      description: 'Needs a look',
      userId: user.id,
    },
  });

  return { user, rule, tag, createdRuleName: `Rule ${nanoid()}` };
};

const expectQueryUnauthorized = async (request: APIRequestContext, route: string, input?: object) => {
  const query = input === undefined ? '' : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;

  const res = await request.get(`${WEBAPP_BASE_URL}/api/trpc/${route}${query}`);

  expect(res.status(), route).toBe(401);
};

const expectMutationUnauthorized = async (request: APIRequestContext, route: string, input: object) => {
  const res = await request.post(`${WEBAPP_BASE_URL}/api/trpc/${route}`, {
    headers: { ...WEBAPP_ORIGIN_HEADERS, 'content-type': 'application/json' },
    data: JSON.stringify({ json: input }),
  });

  expect(res.status(), route).toBe(401);
};

type ExpectNothingChangedOptions = Awaited<ReturnType<typeof seedRuleAndTag>>;

const expectNothingChanged = async ({ user, rule, tag, createdRuleName }: ExpectNothingChangedOptions) => {
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
};
