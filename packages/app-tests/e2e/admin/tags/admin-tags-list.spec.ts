import { alphaid, generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';

import { apiSignin } from '../../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test.skip(
  process.env.NEXT_PUBLIC_IS_DOCUMENSO_CLOUD !== 'true',
  'Test skipped because admin tags are only shown on Documenso Cloud.',
);

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

test('[ADMIN][TAGS_LIST]: tags can be filtered by search, type, subject and source', async ({ page }) => {
  const { adminUser, user, token, descriptions } = await seedTags();

  await apiSignin({ page, email: adminUser.email, redirectPath: `/admin/tags?query=${token}` });

  await expect(getDescriptions(page)).toHaveText([
    descriptions.userTagByRule,
    descriptions.organisationNote,
    descriptions.userNote,
  ]);

  await pickFilter(page, 'Tag', 'Note');
  await expect(getDescriptions(page)).toHaveText([descriptions.organisationNote, descriptions.userNote]);

  await pickFilter(page, 'Tag', 'Clear');

  // The English catalog uses US spelling.
  await pickFilter(page, 'Applies to', 'Organizations');
  await expect(getDescriptions(page)).toHaveText([descriptions.organisationNote]);

  await pickFilter(page, 'Applies to', 'Clear');
  await pickFilter(page, 'Added by', 'A rule');
  await expect(getDescriptions(page)).toHaveText([descriptions.userTagByRule]);

  await pickFilter(page, 'Added by', 'An admin');
  await expect(getDescriptions(page)).toHaveText([descriptions.organisationNote, descriptions.userNote]);

  // The search also matches the tagged user, not just the description.
  await page.goto(`/admin/tags?query=${encodeURIComponent(user.email)}`);
  await expect(getDescriptions(page)).toHaveText([descriptions.userTagByRule, descriptions.userNote]);

  await page.getByPlaceholder('Search by description, user or organisation').fill(`${token} nothing matches this`);
  await expect(page.getByText('No results found')).toBeVisible();
  await expect(getDescriptions(page)).toHaveCount(0);
});

test('[ADMIN][TAGS_LIST]: tags can be sorted by created and updated time', async ({ page }) => {
  const { adminUser, token, descriptions } = await seedTags();

  // A hand-edited sort the page doesn't know falls back to newest first instead of erroring.
  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/tags?query=${token}&orderByColumn=name&orderByDirection=sideways&page=0`,
  });

  await expect(getDescriptions(page)).toHaveText([
    descriptions.userTagByRule,
    descriptions.organisationNote,
    descriptions.userNote,
  ]);

  await page.getByRole('button', { name: 'Created', exact: true }).click();
  await expect(getDescriptions(page)).toHaveText([
    descriptions.userNote,
    descriptions.organisationNote,
    descriptions.userTagByRule,
  ]);

  await page.getByRole('button', { name: 'Updated', exact: true }).click();
  await expect(getDescriptions(page)).toHaveText([
    descriptions.userNote,
    descriptions.userTagByRule,
    descriptions.organisationNote,
  ]);

  await page.getByRole('button', { name: 'Updated', exact: true }).click();
  await expect(getDescriptions(page)).toHaveText([
    descriptions.organisationNote,
    descriptions.userTagByRule,
    descriptions.userNote,
  ]);
});

test('[ADMIN][TAGS_LIST]: the row menu edits and removes tags, closing once picked', async ({ page }) => {
  const { adminUser, token, tags, descriptions } = await seedTags();

  await apiSignin({ page, email: adminUser.email, redirectPath: `/admin/tags?query=${token}` });

  const openRowMenu = async (description: string) => {
    await page.getByRole('row').filter({ hasText: description }).getByRole('button', { name: 'Actions' }).click();
  };

  // Picking an item closes the menu, so it isn't left open once the dialog is done.
  await openRowMenu(descriptions.userNote);
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);

  await page.getByRole('dialog').getByLabel('Description').fill(`${descriptions.userNote} edited`);
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText('Success', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('menu')).toHaveCount(0);

  await openRowMenu(descriptions.organisationNote);
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove tag' }).click();

  await expect(page.getByText('Success', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(getDescriptions(page)).toHaveText([descriptions.userTagByRule, `${descriptions.userNote} edited`]);

  // The page still takes clicks once both dialogs have closed.
  await openRowMenu(descriptions.userTagByRule);
  await expect(page.getByRole('menuitem', { name: 'Remove' })).toBeVisible();

  const remainingTagIds = await prisma.adminTag.findMany({
    where: {
      id: {
        in: [tags.userNote.id, tags.organisationNote.id, tags.userTagByRule.id],
      },
    },
    select: {
      id: true,
    },
  });

  expect(remainingTagIds.map(({ id }) => id).sort()).toEqual([tags.userNote.id, tags.userTagByRule.id].sort());
});

test('[ADMIN][TAGS_LIST]: removing the only tag on the last page goes back to the new last page', async ({ page }) => {
  const { adminUser, token, descriptions } = await seedTags();

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/tags?query=${token}&perPage=2&page=2`,
  });

  await expect(getDescriptions(page)).toHaveText([descriptions.userNote]);

  await page
    .getByRole('row')
    .filter({ hasText: descriptions.userNote })
    .getByRole('button', { name: 'Actions' })
    .click();
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove tag' }).click();

  await expect(getDescriptions(page)).toHaveText([descriptions.userTagByRule, descriptions.organisationNote]);
  await expect(page).not.toHaveURL(/[?&]page=/);
});

/**
 * Two notes and a rule's tag, sharing a search token so each test only sees its own, since tags are
 * global. They were created an hour apart, and the oldest was edited last, so created and updated
 * order differ.
 */
const seedTags = async () => {
  const token = alphaid(12);

  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user, organisation } = await seedUser();

  const rule = await prisma.adminRule.create({
    data: {
      id: generateDatabaseId('admin_rule'),
      name: `Rule ${token}`,
      trigger: 'USER_NAME_CHANGED',
      // Rules are global. This one is disabled, so it never runs against events from other tests.
      mode: 'DISABLED',
      priority: 0,
      stopOnMatch: true,
      // Must pass `ZAdminRuleDefinitionSchema`, or `admin.rule.getMany` fails for parallel rules tests.
      definition: {
        when: {
          type: 'group',
          match: 'all',
          children: [
            {
              type: 'condition',
              field: 'user.new_name',
              operator: 'contains',
              value: token,
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

  const descriptions = {
    userNote: `${token} note on user`,
    organisationNote: `${token} note on organisation`,
    userTagByRule: `${token} user tag by rule`,
  };

  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

  const userNote = await prisma.adminTag.create({
    data: {
      id: generateDatabaseId('admin_tag'),
      type: 'note',
      description: descriptions.userNote,
      userId: user.id,
      createdByUserId: adminUser.id,
      createdAt: hoursAgo(3),
      updatedAt: hoursAgo(0.1),
    },
  });

  const organisationNote = await prisma.adminTag.create({
    data: {
      id: generateDatabaseId('admin_tag'),
      type: 'note',
      description: descriptions.organisationNote,
      organisationId: organisation.id,
      createdByUserId: adminUser.id,
      createdAt: hoursAgo(2),
      updatedAt: hoursAgo(2),
    },
  });

  const userTagByRule = await prisma.adminTag.create({
    data: {
      id: generateDatabaseId('admin_tag'),
      type: 'flagged_for_review',
      description: descriptions.userTagByRule,
      userId: user.id,
      adminRuleId: rule.id,
      createdAt: hoursAgo(1),
      updatedAt: hoursAgo(1),
    },
  });

  return {
    token,
    adminUser,
    user,
    descriptions,
    tags: {
      userNote,
      organisationNote,
      userTagByRule,
    },
  };
};

const getDescriptions = (page: Page) => page.getByTestId('admin-tag-description');

const pickFilter = async (page: Page, filter: string, option: string) => {
  await page.getByRole('button', { name: filter }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
};
