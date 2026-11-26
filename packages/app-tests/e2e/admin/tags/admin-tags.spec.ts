import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[ADMIN][TAGS]: an admin can add, edit and remove a tag on a user', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user } = await seedUser();

  await apiSignin({ page, email: adminUser.email, redirectPath: `/admin/users/${user.id}` });

  const tagsSection = page.getByRole('region', { name: 'Admin tags' });
  const dialog = page.getByRole('dialog');

  await expect(tagsSection.getByText('This user has no tags.')).toBeVisible();

  await tagsSection.getByRole('button', { name: 'Add tag' }).click();

  // A blank description is rejected before anything is saved.
  await dialog.getByRole('button', { name: 'Add tag' }).click();
  await expect(dialog.getByText('Add a description')).toBeVisible();

  await dialog.getByLabel('Description').fill('Reported for phishing');
  await dialog.getByRole('button', { name: 'Add tag' }).click();

  await expect(page.getByText('Tag added', { exact: true })).toBeVisible();
  await expect(dialog).toHaveCount(0);

  const tagItem = tagsSection.getByTestId('admin-tag');

  await expect(tagItem).toHaveCount(1);
  await expect(tagItem.getByText('Flagged for review')).toBeVisible();
  await expect(tagItem.getByText('Reported for phishing')).toBeVisible();
  await expect(tagItem.getByText(`Added by ${adminUser.email}`)).toBeVisible();

  const createdTag = await prisma.adminTag.findFirstOrThrow({
    where: {
      userId: user.id,
    },
  });

  expect(createdTag).toMatchObject({
    type: 'flagged_for_review',
    description: 'Reported for phishing',
    organisationId: null,
    createdByUserId: adminUser.id,
    adminRuleId: null,
  });

  await tagItem.getByRole('button', { name: 'Edit' }).click();

  await expect(dialog.getByLabel('Description')).toHaveValue('Reported for phishing');

  await dialog.getByLabel('Description').fill('Reported for phishing, cleared by support');
  await dialog.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText('Tag updated', { exact: true })).toBeVisible();
  await expect(tagItem.getByText('Reported for phishing, cleared by support')).toBeVisible();
  await expect(tagItem.getByText(/Edited/)).toBeVisible();

  await expect
    .poll(async () =>
      prisma.adminTag.findFirst({
        where: {
          id: createdTag.id,
        },
        select: {
          description: true,
          createdByUserId: true,
        },
      }),
    )
    .toEqual({
      description: 'Reported for phishing, cleared by support',
      createdByUserId: adminUser.id,
    });

  // Removing asks for confirmation first, and cancelling keeps the tag.
  await tagItem.getByRole('button', { name: 'Remove' }).click();
  await expect(dialog.getByText('Reported for phishing, cleared by support')).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(tagItem).toHaveCount(1);

  await tagItem.getByRole('button', { name: 'Remove' }).click();
  await dialog.getByRole('button', { name: 'Remove tag' }).click();

  await expect(page.getByText('Tag removed', { exact: true })).toBeVisible();
  await expect(tagsSection.getByText('This user has no tags.')).toBeVisible();

  await expect
    .poll(async () =>
      prisma.adminTag.findFirst({
        where: {
          id: createdTag.id,
        },
      }),
    )
    .toBeNull();
});

test('[ADMIN][TAGS]: organisation tags are kept apart from the tags on its members', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: owner, organisation } = await seedUser({ isPersonalOrganisation: false });

  await prisma.adminTag.create({
    data: {
      id: generateDatabaseId('admin_tag'),
      type: 'flagged_for_review',
      description: 'Tag on the owner',
      userId: owner.id,
      createdByUserId: adminUser.id,
    },
  });

  await apiSignin({ page, email: adminUser.email, redirectPath: `/admin/organisations/${organisation.id}` });

  const tagsSection = page.getByRole('region', { name: 'Admin tags' });
  const dialog = page.getByRole('dialog');

  await expect(tagsSection.getByText('This organisation has no tags.')).toBeVisible();
  await expect(page.getByText('Tag on the owner')).toHaveCount(0);

  await tagsSection.getByRole('button', { name: 'Add tag' }).click();
  await dialog.getByLabel('Description').fill('Tag on the organisation');
  await dialog.getByRole('button', { name: 'Add tag' }).click();

  await expect(page.getByText('Tag added', { exact: true })).toBeVisible();
  await expect(tagsSection.getByTestId('admin-tag')).toHaveCount(1);
  await expect(tagsSection.getByText('Tag on the organisation')).toBeVisible();

  const organisationTag = await prisma.adminTag.findFirstOrThrow({
    where: {
      organisationId: organisation.id,
    },
  });

  expect(organisationTag).toMatchObject({
    description: 'Tag on the organisation',
    userId: null,
    createdByUserId: adminUser.id,
  });

  await page.goto(`/admin/users/${owner.id}`);

  await expect(tagsSection.getByText('Tag on the owner')).toBeVisible();
  await expect(tagsSection.getByTestId('admin-tag')).toHaveCount(1);
  await expect(page.getByText('Tag on the organisation')).toHaveCount(0);
});
