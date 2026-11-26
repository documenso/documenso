import { ADMIN_RULE_LIMITS } from '@documenso/lib/constants/admin-rules';
import type { TAdminRuleTrigger } from '@documenso/lib/types/admin-rules';
import { generateDatabaseId, nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Locator, type Page, test } from '@playwright/test';

import { apiSignin, WEBAPP_ORIGIN_HEADERS } from '../../fixtures/authentication';
import { waitForHydration } from '../../fixtures/hydration';

test.describe.configure({ mode: 'parallel' });

test.skip(
  process.env.NEXT_PUBLIC_IS_DOCUMENSO_CLOUD !== 'true',
  'Test skipped because the rules pages are only available on Documenso Cloud.',
);

// Rules are global, so every test uses a unique name and removes its own rows afterwards.
const ruleNamesToCleanup: string[] = [];

const trackRule = (name: string) => {
  ruleNamesToCleanup.push(name);
  return name;
};

test.afterEach(async () => {
  if (ruleNamesToCleanup.length > 0) {
    await prisma.adminRule.deleteMany({
      where: {
        name: {
          in: ruleNamesToCleanup,
        },
      },
    });
    ruleNamesToCleanup.length = 0;
  }
});

type SeedMonitorRuleOptions = {
  trigger?: TAdminRuleTrigger;
};

// The condition looks for the rule's own unique name, so the rule never matches another test's event.
const seedMonitorRule = async (name: string, { trigger = 'DOCUMENT_SENT' }: SeedMonitorRuleOptions = {}) => {
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
      name,
      trigger,
      mode: 'MONITOR',
      priority: (lastRule?.priority ?? -1) + 1,
      stopOnMatch: true,
      definition: {
        when: {
          type: 'group',
          match: 'all',
          children: [
            {
              type: 'condition',
              field: 'envelope.title',
              operator: 'contains',
              value: name,
            },
          ],
        },
        actions: [
          {
            type: 'log_only',
            params: {
              note: '',
            },
          },
        ],
      },
    },
  });
};

const findRuleRow = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name });

const findRuleMode = async (ruleId: string) => {
  const rule = await prisma.adminRule.findFirstOrThrow({
    where: {
      id: ruleId,
    },
  });

  return rule.mode;
};

// The given rules' ids, in the order the engine runs them.
const findRuleOrder = async (ruleIds: string[]) => {
  const rules = await prisma.adminRule.findMany({
    where: {
      id: {
        in: ruleIds,
      },
    },
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

const openNewRuleEditor = async (page: Page, email: string) => {
  await apiSignin({ page, email, redirectPath: '/admin/rules/new' });

  // Filling the form before React hydrates it loses what was typed.
  await waitForHydration(page, 'input[name="name"]');
};

type SetConditionOptions = {
  index: number;
  field: string;
  operator: string;
  value: string;
};

const setCondition = async (page: Page, { index, field, operator, value }: SetConditionOptions) => {
  await page.getByTestId('admin-rule-condition-field').nth(index).click();
  await page.getByRole('option', { name: field, exact: true }).click();

  await page.getByTestId('admin-rule-condition-operator').nth(index).click();
  await page.getByRole('option', { name: operator, exact: true }).click();

  await page.getByTestId('admin-rule-condition-value').nth(index).fill(value);
};

const addAction = async (page: Page, action: string) => {
  await page.getByRole('button', { name: 'Add action' }).click();
  await page.getByRole('menuitem', { name: action }).click();
};

const findRuleByName = async (name: string) =>
  await prisma.adminRule.findFirstOrThrow({
    where: {
      name,
    },
  });

test('[ADMIN][RULES]: the editor recommends blocking the event when disabling the user', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await openNewRuleEditor(page, adminUser.email);

  const recommendation = page.getByTestId('admin-rule-block-recommendation');

  await page.getByRole('button', { name: 'Add action' }).first().click();
  await page.getByRole('menuitem', { name: /Disable user/ }).click();

  await expect(recommendation).toBeVisible();

  await page.getByRole('button', { name: 'Add action' }).first().click();
  await page.getByRole('menuitem', { name: /Block the event/ }).click();

  await expect(recommendation).toHaveCount(0);

  // Changing the block into another action brings the recommendation back.
  await page.getByRole('combobox').filter({ hasText: 'Block the event' }).click();
  await page.getByRole('option', { name: 'Log only' }).click();

  await expect(recommendation).toBeVisible();
});

test('[ADMIN][RULES]: picking a field of another type switches to an operator it supports', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await openNewRuleEditor(page, adminUser.email);

  const fieldPicker = page.getByTestId('admin-rule-condition-field').first();
  const operatorPicker = page.getByTestId('admin-rule-condition-operator').first();

  // The first condition starts on sender.id, a number field, with "equals".
  await fieldPicker.click();
  await page.getByRole('option', { name: 'sender.plan', exact: true }).click();

  await expect(operatorPicker).toHaveText('is');

  await fieldPicker.click();
  await page.getByRole('option', { name: 'sender.account_age_days', exact: true }).click();

  await expect(operatorPicker).toHaveText('equals');
});

test('[ADMIN][RULES]: create a rule with nested condition groups in the editor', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const ruleName = trackRule(`Rule ${nanoid()}`);

  await openNewRuleEditor(page, adminUser.email);

  await page.getByLabel('Rule name').fill(ruleName);

  const fillCondition = async (scope: Page | Locator, index: number, value: string) => {
    await scope.getByTestId('admin-rule-condition-field').nth(index).click();
    await page.getByRole('option', { name: 'envelope.title', exact: true }).click();

    await scope.getByTestId('admin-rule-condition-operator').nth(index).click();
    await page.getByRole('option', { name: 'contains', exact: true }).click();

    await scope.getByTestId('admin-rule-condition-value').nth(index).fill(value);
  };

  // envelope.title contains "invoice" AND (envelope.title contains "contract" OR … "agreement")
  await fillCondition(page, 0, 'invoice');

  await page.getByRole('button', { name: 'Add condition group' }).click();

  const group = page.getByTestId('admin-rule-condition-group');

  // The editor allows one level of nesting, so a nested group cannot hold another group.
  await expect(group.getByRole('button', { name: 'Add condition group' })).toHaveCount(0);

  await fillCondition(group, 0, 'contract');

  await group.getByRole('button', { name: 'Add condition', exact: true }).click();
  await fillCondition(group, 1, 'agreement');

  await group.getByTestId('admin-rule-group-match').click();
  await page.getByRole('option', { name: /^or$/i }).click();

  await page.getByRole('button', { name: 'Add action' }).first().click();
  await page.getByRole('menuitem', { name: /Log only/ }).click();

  await expect(
    page.getByText(
      'envelope.title contains "invoice" AND (envelope.title contains "contract" OR envelope.title contains "agreement")',
    ),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Rule created', { exact: true })).toBeVisible();

  const rule = await findRuleByName(ruleName);

  // Saving opens the new rule's page.
  await page.waitForURL(`/admin/rules/${rule.id}`);

  // New rules start on the default trigger, in monitor mode, so they never enforce before review.
  expect(rule.trigger).toEqual('DOCUMENT_SENT');
  expect(rule.mode).toEqual('MONITOR');
  expect(rule.definition.when).toMatchObject({
    type: 'group',
    match: 'all',
    children: [
      { type: 'condition', field: 'envelope.title', operator: 'contains', value: 'invoice' },
      {
        type: 'group',
        match: 'any',
        children: [
          { type: 'condition', field: 'envelope.title', operator: 'contains', value: 'contract' },
          { type: 'condition', field: 'envelope.title', operator: 'contains', value: 'agreement' },
        ],
      },
    ],
  });
});

test('[ADMIN][RULES]: validation prevents saving a rule without actions', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const ruleName = trackRule(`Rule ${nanoid()}`);

  await openNewRuleEditor(page, adminUser.email);

  await page.getByLabel('Rule name').fill(ruleName);
  await page.getByTestId('admin-rule-condition-value').first().fill('1');

  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Add at least one action')).toBeVisible();

  const ruleCount = await prisma.adminRule.count({
    where: {
      name: ruleName,
    },
  });

  expect(ruleCount).toEqual(0);
});

test('[ADMIN][RULES]: the enabled switch turns a rule off, and back on in monitor mode', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const ruleName = trackRule(`Rule ${nanoid()}`);
  const rule = await seedMonitorRule(ruleName);

  // Start from an enforced rule, so switching it back on must not resume enforcing.
  await prisma.adminRule.update({
    where: {
      id: rule.id,
    },
    data: {
      mode: 'ENFORCE',
    },
  });

  await apiSignin({ page, email: adminUser.email, redirectPath: '/admin/rules' });

  const row = findRuleRow(page, ruleName);
  await expect(row).toBeVisible();

  await row.getByRole('switch').click();

  await expect(page.getByText('Rule updated', { exact: true })).toBeVisible();

  await expect.poll(async () => findRuleMode(rule.id)).toEqual('DISABLED');

  await row.getByRole('switch').click();

  await expect.poll(async () => findRuleMode(rule.id)).toEqual('MONITOR');
});

test('[ADMIN][RULES]: edit an existing rule', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const ruleName = trackRule(`Rule ${nanoid()}`);
  const updatedName = trackRule(`${ruleName} updated`);
  const rule = await seedMonitorRule(ruleName);

  await apiSignin({ page, email: adminUser.email, redirectPath: `/admin/rules/${rule.id}` });

  await page.getByLabel('Rule name').fill(updatedName);
  await page.getByRole('radio', { name: 'Enforce' }).click();

  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Rule updated', { exact: true })).toBeVisible();

  const updatedRule = await prisma.adminRule.findFirstOrThrow({
    where: {
      id: rule.id,
    },
  });

  expect(updatedRule.name).toEqual(updatedName);
  expect(updatedRule.mode).toEqual('ENFORCE');
});

test('[ADMIN][RULES]: delete a rule from the list', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const ruleName = trackRule(`Rule ${nanoid()}`);
  const rule = await seedMonitorRule(ruleName);

  await apiSignin({ page, email: adminUser.email, redirectPath: '/admin/rules' });

  const row = findRuleRow(page, ruleName);
  await expect(row).toBeVisible();

  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(ruleName)).toBeVisible();

  await dialog.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText('Rule deleted', { exact: true })).toBeVisible();

  await expect
    .poll(async () =>
      prisma.adminRule.findFirst({
        where: {
          id: rule.id,
        },
      }),
    )
    .toBeNull();
});

test('[ADMIN][RULES]: non admins cannot access the rules page', async ({ page }) => {
  const { user } = await seedUser();

  await apiSignin({ page, email: user.email, redirectPath: '/admin/rules' });

  await expect(page).not.toHaveURL(/\/admin\/rules/);
});

test('[ADMIN][RULES]: the events page lists matches and filters by rule', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user } = await seedUser();

  const matchedRule = await seedMonitorRule(trackRule(`Rule ${nanoid()}`));
  const otherRule = await seedMonitorRule(trackRule(`Rule ${nanoid()}`));

  await prisma.adminRuleMatch.create({
    data: {
      id: generateDatabaseId('admin_rule_match'),
      ruleId: matchedRule.id,
      mode: 'MONITOR',
      trigger: 'DOCUMENT_SENT',
      actorUserId: user.id,
      eventSnapshot: {},
      actionsRun: [
        {
          type: 'log_only',
          status: 'would_run',
        },
      ],
    },
  });

  await apiSignin({ page, email: adminUser.email, redirectPath: '/admin/rules' });

  await page.getByRole('link', { name: 'Events' }).click();
  await page.waitForURL('/admin/rules/events');

  const matchedRow = page.getByRole('row').filter({ hasText: matchedRule.name });
  await expect(matchedRow).toBeVisible();
  await expect(matchedRow.getByText(user.email)).toBeVisible();

  // Filtering by the other rule hides the match.
  await page.getByRole('button', { name: 'Rule' }).click();
  await page.getByRole('option', { name: otherRule.name }).click();

  await expect(page.getByRole('row').filter({ hasText: matchedRule.name })).toHaveCount(0);
  await expect(page.getByText('No results found')).toBeVisible();
});

test('[ADMIN][RULES]: the server rejects invalid rules on create', async ({ page }) => {
  const { user: adminUser, organisation } = await seedUser({ isAdmin: true });

  const validRuleName = trackRule(`Rule ${nanoid()}`);
  const invalidRuleName = trackRule(`Rule ${nanoid()}`);

  const condition = {
    type: 'condition',
    field: 'user.new_name',
    operator: 'contains',
    value: validRuleName,
  };

  const validRule = {
    name: validRuleName,
    description: null,
    trigger: 'USER_NAME_CHANGED',
    mode: 'DISABLED',
    stopOnMatch: true,
    definition: {
      when: {
        type: 'group',
        match: 'all',
        children: [condition],
      },
      actions: [
        {
          type: 'log_only',
          params: {},
        },
      ],
    },
    exemptOrganisationIds: [],
  };

  const createRule = async (rule: object) =>
    await page.request.post('/api/trpc/admin.rule.create', {
      headers: WEBAPP_ORIGIN_HEADERS,
      data: {
        json: rule,
      },
    });

  await apiSignin({ page, email: adminUser.email, redirectPath: '/admin/rules' });

  // Each invalid rule differs from this one in a single way, so it is rejected for that reason alone.
  expect((await createRule(validRule)).status()).toBe(200);

  // Go straight to the API: the editor prevents most of these, so this guards the server-side checks.
  const createInvalidRule = async (invalidPart: object) =>
    await createRule({
      ...validRule,
      name: invalidRuleName,
      ...invalidPart,
    });

  const withExemptionOnUserTrigger = await createInvalidRule({
    exemptOrganisationIds: [organisation.id],
  });

  expect(withExemptionOnUserTrigger.status(), 'organisation exemption on a user trigger').toBe(400);

  const withBlockOnSignUp = await createInvalidRule({
    trigger: 'USER_SIGNED_UP',
    definition: {
      ...validRule.definition,
      when: {
        ...validRule.definition.when,
        children: [{ ...condition, field: 'user.email_domain' }],
      },
      actions: [
        {
          type: 'block_event',
          params: {},
        },
      ],
    },
  });

  expect(withBlockOnSignUp.status(), 'block action on the sign-up trigger').toBe(400);

  const withTooManyConditions = await createInvalidRule({
    definition: {
      ...validRule.definition,
      when: {
        ...validRule.definition.when,
        children: Array.from({ length: ADMIN_RULE_LIMITS.maxConditions + 1 }, () => condition),
      },
    },
  });

  expect(withTooManyConditions.status(), 'more conditions than the limit').toBe(400);

  const withEmptyGroup = await createInvalidRule({
    definition: {
      ...validRule.definition,
      when: {
        ...validRule.definition.when,
        children: [
          condition,
          {
            type: 'group',
            match: 'any',
            children: [],
          },
        ],
      },
    },
  });

  expect(withEmptyGroup.status(), 'a nested group without conditions').toBe(400);

  const withoutActions = await createInvalidRule({
    definition: {
      ...validRule.definition,
      actions: [],
    },
  });

  expect(withoutActions.status(), 'no actions').toBe(400);

  const invalidRuleCount = await prisma.adminRule.count({
    where: {
      name: invalidRuleName,
    },
  });

  expect(invalidRuleCount).toEqual(0);
});

const updateRule = async (page: Page, ruleId: string, data: object) =>
  await page.request.post('/api/trpc/admin.rule.update', {
    headers: WEBAPP_ORIGIN_HEADERS,
    data: {
      json: {
        ruleId,
        data,
      },
    },
  });

test('[ADMIN][RULES]: the server rejects updates that leave a rule invalid, checking unchanged fields too', async ({
  page,
}) => {
  const { user: adminUser, organisation } = await seedUser({ isAdmin: true });

  const ruleName = trackRule(`Rule ${nanoid()}`);
  const rule = await seedMonitorRule(ruleName);

  await prisma.adminRule.update({
    where: {
      id: rule.id,
    },
    data: {
      exemptOrganisationIds: [organisation.id],
    },
  });

  const userNameDefinition = {
    when: {
      type: 'group',
      match: 'all',
      children: [
        {
          type: 'condition',
          field: 'user.new_name',
          operator: 'contains',
          value: ruleName,
        },
      ],
    },
    actions: [
      {
        type: 'log_only',
        params: {},
      },
    ],
  };

  await apiSignin({ page, email: adminUser.email, redirectPath: '/admin/rules' });

  const withoutActions = await updateRule(page, rule.id, {
    definition: {
      ...userNameDefinition,
      actions: [],
    },
  });

  expect(withoutActions.status(), 'a definition without actions').toBe(400);

  // The stored definition checks `envelope.title`, which sign-up events don't have.
  const withTriggerOnly = await updateRule(page, rule.id, {
    trigger: 'USER_SIGNED_UP',
  });

  expect(withTriggerOnly.status(), 'a trigger the stored definition does not fit').toBe(400);

  // Valid on its own, but the stored exemptions can't apply to a user-level trigger.
  const withStoredExemptions = await updateRule(page, rule.id, {
    trigger: 'USER_NAME_CHANGED',
    definition: userNameDefinition,
  });

  expect(withStoredExemptions.status(), 'a user trigger with the stored exemptions').toBe(400);

  const unchangedRule = await prisma.adminRule.findFirstOrThrow({
    where: {
      id: rule.id,
    },
  });

  expect(unchangedRule.trigger).toEqual(rule.trigger);
  expect(unchangedRule.definition).toEqual(rule.definition);
  expect(unchangedRule.exemptOrganisationIds).toEqual([organisation.id]);

  const withExemptionsCleared = await updateRule(page, rule.id, {
    trigger: 'USER_NAME_CHANGED',
    definition: userNameDefinition,
    exemptOrganisationIds: [],
  });

  expect(withExemptionsCleared.status()).toBe(200);
});

test('[ADMIN][RULES]: a rule that no longer validates can be renamed or turned off, but not switched on', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  // `seedMonitorRule` checks `envelope.title`, which sign-up events don't have, so this rule is stored
  // invalid, as a rule would be after a field it uses is removed.
  const rule = await seedMonitorRule(trackRule(`Rule ${nanoid()}`), { trigger: 'USER_SIGNED_UP' });
  const newName = trackRule(`Rule ${nanoid()}`);

  await apiSignin({ page, email: adminUser.email, redirectPath: '/admin/rules' });

  expect((await updateRule(page, rule.id, { name: newName })).status()).toBe(200);
  expect((await updateRule(page, rule.id, { mode: 'DISABLED' })).status()).toBe(200);
  expect((await updateRule(page, rule.id, { mode: 'MONITOR' })).status()).toBe(400);
  expect((await updateRule(page, rule.id, { mode: 'ENFORCE' })).status()).toBe(400);

  const updatedRule = await prisma.adminRule.findFirstOrThrow({
    where: {
      id: rule.id,
    },
  });

  expect(updatedRule.name).toEqual(newName);
  expect(updatedRule.mode).toEqual('DISABLED');
});

test('[ADMIN][RULES]: changing the trigger starts the rule over on the new trigger', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const ruleName = trackRule(`Rule ${nanoid()}`);

  await openNewRuleEditor(page, adminUser.email);

  await page.getByLabel('Rule name').fill(ruleName);

  await setCondition(page, { index: 0, field: 'envelope.title', operator: 'contains', value: 'invoice' });
  await addAction(page, 'Log only');

  await expect(page.getByTestId('admin-rule-exempt-organisations')).toBeVisible();

  await page.getByLabel('Trigger', { exact: true }).click();
  await page.getByRole('option', { name: 'User changes their name' }).click();

  // The condition starts over on the new trigger's first field, the action is gone, and a
  // user-level trigger has no organisations to exempt.
  await expect(page.getByTestId('admin-rule-condition-field')).toHaveText(['user.id']);
  await expect(page.getByRole('button', { name: 'Remove action' })).toHaveCount(0);
  await expect(page.getByTestId('admin-rule-exempt-organisations')).toHaveCount(0);

  await setCondition(page, { index: 0, field: 'user.new_name', operator: 'contains', value: 'support' });
  await addAction(page, 'Block the event');

  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Rule created', { exact: true })).toBeVisible();

  const rule = await findRuleByName(ruleName);

  expect(rule.trigger).toEqual('USER_NAME_CHANGED');
  expect(rule.definition).toEqual({
    when: {
      type: 'group',
      match: 'all',
      children: [{ type: 'condition', field: 'user.new_name', operator: 'contains', value: 'support' }],
    },
    actions: [{ type: 'block_event', params: {} }],
  });
});

test('[ADMIN][RULES]: the editor saves action settings, stop on match and exempt organisations', async ({ page }) => {
  const { user: adminUser, organisation } = await seedUser({ isAdmin: true });

  const ruleName = trackRule(`Rule ${nanoid()}`);

  await openNewRuleEditor(page, adminUser.email);

  await page.getByLabel('Rule name').fill(ruleName);

  await setCondition(page, { index: 0, field: 'envelope.title', operator: 'contains', value: 'invoice' });

  await addAction(page, 'Flag account for review');
  await page.getByLabel('Reason').fill('Sends invoices from a new account');

  // On by default.
  await page.getByLabel('Stop on match').click();

  // Searching by id finds only this organisation.
  const exemptions = page.getByTestId('admin-rule-exempt-organisations');

  await exemptions.getByRole('combobox').fill(organisation.id);
  await page.getByRole('option', { name: organisation.url }).click();
  await exemptions.getByRole('combobox').press('Escape');

  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Rule created', { exact: true })).toBeVisible();

  const rule = await findRuleByName(ruleName);

  expect(rule.stopOnMatch).toBe(false);
  expect(rule.exemptOrganisationIds).toEqual([organisation.id]);
  expect(rule.definition.actions).toEqual([
    { type: 'flag_account_for_review', params: { reason: 'Sends invoices from a new account' } },
  ]);
});

test('[ADMIN][RULES]: remove conditions, groups and actions in the editor', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const ruleName = trackRule(`Rule ${nanoid()}`);

  await openNewRuleEditor(page, adminUser.email);

  await page.getByLabel('Rule name').fill(ruleName);

  await setCondition(page, { index: 0, field: 'envelope.title', operator: 'contains', value: 'invoice' });

  // A rule always keeps at least one condition.
  await expect(page.getByRole('button', { name: 'Remove condition' })).toBeDisabled();

  await page.getByRole('button', { name: 'Add condition', exact: true }).click();
  await setCondition(page, { index: 1, field: 'envelope.title', operator: 'contains', value: 'contract' });

  const group = page.getByTestId('admin-rule-condition-group');

  // Removing the only condition in a group removes the group.
  await page.getByRole('button', { name: 'Add condition group' }).click();
  await group.getByRole('button', { name: 'Remove condition' }).click();

  await expect(group).toHaveCount(0);

  await page.getByRole('button', { name: 'Add condition group' }).click();
  await page.getByRole('button', { name: 'Remove group' }).click();

  await expect(group).toHaveCount(0);

  await page.getByRole('button', { name: 'Remove condition' }).nth(1).click();

  await addAction(page, 'Log only');
  await addAction(page, 'Block the event');

  await page.getByRole('button', { name: 'Remove action' }).first().click();

  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Rule created', { exact: true })).toBeVisible();

  const rule = await findRuleByName(ruleName);

  expect(rule.definition).toEqual({
    when: {
      type: 'group',
      match: 'all',
      children: [{ type: 'condition', field: 'envelope.title', operator: 'contains', value: 'invoice' }],
    },
    actions: [{ type: 'block_event', params: {} }],
  });
});

test('[ADMIN][RULES]: the tester shows what the rule would do with the sample event', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await openNewRuleEditor(page, adminUser.email);

  await setCondition(page, { index: 0, field: 'envelope.title', operator: 'contains', value: 'contract' });

  // A rule without actions can't be saved, so it has no result yet.
  await expect(page.getByText('Rule incomplete', { exact: true })).toBeVisible();

  await addAction(page, 'Log only');

  // The sample document is titled "Invoice #1042".
  const sampleTitle = page.getByLabel('envelope.title', { exact: true });

  await expect(sampleTitle).toHaveValue('Invoice #1042');
  await expect(page.getByText('No match', { exact: true })).toBeVisible();

  await sampleTitle.fill('Contract for Jane');

  await expect(page.getByText('Conditions match', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Monitor mode: the match would be logged but these actions would not run.'),
  ).toBeVisible();

  await page.getByRole('radio', { name: 'Enforce' }).click();

  await expect(page.getByText('These actions would run, in this order.')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Log only' })).toBeVisible();

  await page.getByRole('radio', { name: 'Disabled' }).click();

  await expect(page.getByText('Rule disabled', { exact: true })).toBeVisible();

  await page.getByRole('radio', { name: 'Enforce' }).click();
  await page.getByRole('button', { name: 'Reset sample event' }).click();

  await expect(sampleTitle).toHaveValue('Invoice #1042');
  await expect(page.getByText('No match', { exact: true })).toBeVisible();
});

test('[ADMIN][RULES]: the trigger filter shows only the rules on that trigger', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const signUpRule = await seedMonitorRule(trackRule(`Rule ${nanoid()}`), { trigger: 'USER_SIGNED_UP' });
  const sendRule = await seedMonitorRule(trackRule(`Rule ${nanoid()}`));

  await apiSignin({ page, email: adminUser.email, redirectPath: '/admin/rules' });

  await expect(findRuleRow(page, signUpRule.name)).toBeVisible();
  await expect(findRuleRow(page, sendRule.name)).toBeVisible();

  await page.getByRole('button', { name: 'Trigger' }).click();
  await page.getByRole('option', { name: 'User signs up' }).click();

  await expect(page).toHaveURL(/trigger=USER_SIGNED_UP/);
  await expect(findRuleRow(page, signUpRule.name)).toBeVisible();
  await expect(findRuleRow(page, sendRule.name)).toHaveCount(0);
});

test('[ADMIN][RULES]: moving a rule in a filtered list swaps it with the rule above it on that trigger', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const upperRule = await seedMonitorRule(trackRule(`Rule ${nanoid()}`), { trigger: 'USER_SIGNED_UP' });
  const otherRule = await seedMonitorRule(trackRule(`Rule ${nanoid()}`));
  const lowerRule = await seedMonitorRule(trackRule(`Rule ${nanoid()}`), { trigger: 'USER_SIGNED_UP' });

  // Above every other rule, so no other test's rule ends up between them.
  const priorities = [
    [upperRule.id, -3],
    [otherRule.id, -2],
    [lowerRule.id, -1],
  ] as const;

  for (const [ruleId, priority] of priorities) {
    await prisma.adminRule.update({
      where: {
        id: ruleId,
      },
      data: {
        priority,
      },
    });
  }

  await apiSignin({ page, email: adminUser.email, redirectPath: '/admin/rules?trigger=USER_SIGNED_UP' });

  const moveUpButton = findRuleRow(page, lowerRule.name).getByRole('button', { name: 'Move up' });

  // A move sends every rule's id, so it fails when another test adds or removes a rule after the
  // list loaded. Reload and try again until it goes through.
  await expect(async () => {
    await page.reload();
    await waitForHydration(page, 'a[href="/admin/rules/new"]');

    await moveUpButton.click();

    await expect
      .poll(async () => findRuleOrder([upperRule.id, otherRule.id, lowerRule.id]), { timeout: 5_000 })
      .toEqual([lowerRule.id, otherRule.id, upperRule.id]);
  }).toPass({ timeout: 30_000 });

  // It's now the first rule on the trigger, so it can't move up any further.
  await expect(moveUpButton).toBeDisabled();
});
