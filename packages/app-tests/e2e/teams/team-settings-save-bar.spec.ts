import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../fixtures/authentication';

test('[TEAMS]: settings save bar docks at the bottom of the form', async ({ page }) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings`,
  });

  await expect(page.getByLabel('Team Name*')).toBeVisible();

  const saveButton = page.getByRole('button', { name: 'Save changes' });

  // Pristine: the docked Save button is present but disabled; no Undo, no floating notice.
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
  await expect(page.getByText('You have unsaved changes')).not.toBeVisible();

  // Make a change → Save enables and Undo appears.
  const updatedName = `team-${Date.now()}`;
  await page.getByLabel('Team Name*').clear();
  await page.getByLabel('Team Name*').fill(updatedName);

  await expect(saveButton).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();

  // Undo → value restored, Save disabled again, Undo gone.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByLabel('Team Name*')).toHaveValue(team.name);
  await expect(saveButton).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);

  // Change again → Save → success toast, returns to a pristine (disabled) state.
  await page.getByLabel('Team Name*').clear();
  await page.getByLabel('Team Name*').fill(updatedName);
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  await expect(page.getByText('Your team has been successfully updated.').first()).toBeVisible();
  await expect(saveButton).toBeDisabled();
});

test('[ORGANISATIONS]: settings save bar floats when the form footer is off-screen', async ({ page }) => {
  const { user, organisation } = await seedUser({
    isPersonalOrganisation: false,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/document`,
  });

  // Wait for the long document-preferences form to load.
  await expect(page.getByTestId('document-language-trigger')).toBeVisible();

  // Pristine: no floating notice even though the footer is below the fold.
  await expect(page.getByText('You have unsaved changes')).not.toBeVisible();

  // Edit a field near the top → the footer is off-screen, so the floating pill appears.
  await page.getByTestId('document-language-trigger').click();
  await page.getByRole('option', { name: 'German' }).click();

  await expect(page.getByText('You have unsaved changes')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();

  // Scroll to the footer → the floating pill merges into the docked buttons and the
  // notice disappears.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  await expect(page.getByText('You have unsaved changes')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
});
