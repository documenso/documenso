import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test.skip(
  process.env.NEXT_PUBLIC_IS_DOCUMENSO_CLOUD !== 'true',
  'Test skipped because admin tags are only shown on Documenso Cloud.',
);

test('[ADMIN][TAGS]: an admin can add, edit and remove a tag on a user', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user } = await seedUser();

  await apiSignin({ page, email: adminUser.email, redirectPath: `/admin/users/${user.id}` });

  const tagsSection = page.getByRole('region', { name: 'Admin tags' });
  const dialog = page.getByRole('dialog');

  await expect(tagsSection.getByText('This user has no tags.')).toBeVisible();

  await tagsSection.getByRole('button', { name: 'Add tag' }).click();

  // New tags on the user page start as notes.
  await expect(dialog.getByRole('combobox')).toHaveText('Note');

  // A blank description is rejected before anything is saved.
  await dialog.getByRole('button', { name: 'Add tag' }).click();
  await expect(dialog.getByText('Add a description')).toBeVisible();

  await dialog.getByLabel('Description').fill('Reported for phishing');
  await dialog.getByRole('button', { name: 'Add tag' }).click();

  await expect(page.getByText('Success', { exact: true })).toBeVisible();
  await expect(dialog).toHaveCount(0);

  const tagItem = tagsSection.getByTestId('admin-tag');

  await expect(tagItem).toHaveCount(1);
  await expect(tagItem.getByText('Note', { exact: true })).toBeVisible();
  await expect(tagItem.getByText('Reported for phishing')).toBeVisible();
  await expect(tagItem.getByText(`Added by ${adminUser.email}`)).toBeVisible();

  const createdTag = await prisma.adminTag.findFirstOrThrow({
    where: {
      userId: user.id,
    },
  });

  expect(createdTag).toMatchObject({
    type: 'note',
    description: 'Reported for phishing',
    organisationId: null,
    createdByUserId: adminUser.id,
    adminRuleId: null,
  });

  await tagItem.getByRole('button', { name: 'Edit' }).click();

  await expect(dialog.getByRole('combobox')).toHaveText('Note');
  await expect(dialog.getByLabel('Description')).toHaveValue('Reported for phishing');

  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Flagged for review' }).click();
  await dialog.getByLabel('Description').fill('Reported for phishing, cleared by support');
  await dialog.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText('Success', { exact: true })).toBeVisible();
  await expect(tagItem.getByText('Flagged for review')).toBeVisible();
  await expect(tagItem.getByText('Reported for phishing, cleared by support')).toBeVisible();
  await expect(tagItem.getByText(/Edited/)).toBeVisible();

  await expect
    .poll(async () =>
      prisma.adminTag.findFirst({
        where: {
          id: createdTag.id,
        },
        select: {
          type: true,
          description: true,
          createdByUserId: true,
        },
      }),
    )
    .toEqual({
      type: 'flagged_for_review',
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

  await expect(page.getByText('Success', { exact: true })).toBeVisible();
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

test('[ADMIN][TAGS]: system tags show beside notes, and editing one keeps its type', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user } = await seedUser();

  await prisma.adminTag.create({
    data: {
      id: generateDatabaseId('admin_tag'),
      type: 'note',
      description: 'Spoke to them on a call',
      userId: user.id,
      createdByUserId: adminUser.id,
    },
  });

  const systemTag = await prisma.adminTag.create({
    data: {
      id: generateDatabaseId('admin_tag'),
      type: 'flagged_for_review',
      description: 'Sent too many documents',
      userId: user.id,
    },
  });

  await apiSignin({ page, email: adminUser.email, redirectPath: `/admin/users/${user.id}` });

  const tagsSection = page.getByRole('region', { name: 'Admin tags' });
  const dialog = page.getByRole('dialog');

  const noteItem = tagsSection.getByTestId('admin-tag').filter({ hasText: 'Spoke to them on a call' });
  const systemTagItem = tagsSection.getByTestId('admin-tag').filter({ hasText: 'Sent too many' });

  await expect(noteItem.getByText('Note', { exact: true })).toBeVisible();
  await expect(systemTagItem.getByText('Flagged for review')).toBeVisible();

  // Editing starts from the tag's own type, not the page's default for new tags.
  await systemTagItem.getByRole('button', { name: 'Edit' }).click();
  await expect(dialog.getByRole('combobox')).toHaveText('Flagged for review');

  await dialog.getByLabel('Description').fill('Sent too many documents, checked by support');
  await dialog.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText('Success', { exact: true })).toBeVisible();
  await expect(systemTagItem.getByText('Sent too many documents, checked by support')).toBeVisible();
  await expect(systemTagItem.getByText('Flagged for review')).toBeVisible();

  await expect
    .poll(async () =>
      prisma.adminTag.findFirst({
        where: {
          id: systemTag.id,
        },
        select: {
          type: true,
          description: true,
        },
      }),
    )
    .toEqual({
      type: 'flagged_for_review',
      description: 'Sent too many documents, checked by support',
    });

  await systemTagItem.getByRole('button', { name: 'Remove' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove tag' }).click();

  await expect(page.getByText('Success', { exact: true })).toBeVisible();
  await expect(systemTagItem).toHaveCount(0);
  await expect(noteItem).toHaveCount(1);

  await expect
    .poll(async () =>
      prisma.adminTag.findFirst({
        where: {
          id: systemTag.id,
        },
      }),
    )
    .toBeNull();
});

test('[ADMIN][TAGS]: organisation notes are kept apart from the tags on its members', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: owner, organisation } = await seedUser({ isPersonalOrganisation: false });

  await prisma.adminTag.create({
    data: {
      id: generateDatabaseId('admin_tag'),
      type: 'note',
      description: 'Note on the owner',
      userId: owner.id,
      createdByUserId: adminUser.id,
    },
  });

  await apiSignin({ page, email: adminUser.email, redirectPath: `/admin/organisations/${organisation.id}` });

  const tagsSection = page.getByRole('region', { name: 'Admin tags' });
  const dialog = page.getByRole('dialog');

  await expect(tagsSection.getByText('This organisation has no tags.')).toBeVisible();
  await expect(page.getByText('Note on the owner')).toHaveCount(0);

  await tagsSection.getByRole('button', { name: 'Add tag' }).click();
  await dialog.getByLabel('Description').fill('Note on the organisation');
  await dialog.getByRole('button', { name: 'Add tag' }).click();

  await expect(page.getByText('Success', { exact: true })).toBeVisible();
  await expect(tagsSection.getByTestId('admin-tag')).toHaveCount(1);
  await expect(tagsSection.getByText('Note on the organisation')).toBeVisible();

  const organisationTag = await prisma.adminTag.findFirstOrThrow({
    where: {
      organisationId: organisation.id,
    },
  });

  expect(organisationTag).toMatchObject({
    type: 'note',
    description: 'Note on the organisation',
    userId: null,
    createdByUserId: adminUser.id,
  });

  await page.goto(`/admin/users/${owner.id}`);

  await expect(tagsSection.getByText('Note on the owner')).toBeVisible();
  await expect(tagsSection.getByTestId('admin-tag')).toHaveCount(1);
  await expect(page.getByText('Note on the organisation')).toHaveCount(0);
});
