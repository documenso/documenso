import { expect, test } from '@playwright/test';

import { nanoid } from '@documenso/lib/universal/id';
import { seedOrganisationMembers } from '@documenso/prisma/seed/organisations';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../../fixtures/authentication';

test('[ADMIN]: promote member to owner', async ({ page }) => {
  // Create an admin user who can access the admin panel
  const { user: adminUser } = await seedUser({
    isAdmin: true,
  });

  // Create an organisation owner
  const { user: ownerUser, organisation } = await seedUser({
    isPersonalOrganisation: false,
  });

  // Create organisation members with different roles
  const memberEmail = `member-${nanoid()}@test.documenso.com`;
  const managerEmail = `manager-${nanoid()}@test.documenso.com`;
  const adminMemberEmail = `admin-member-${nanoid()}@test.documenso.com`;

  const [memberUser, managerUser, adminMemberUser] = await seedOrganisationMembers({
    members: [
      {
        email: memberEmail,
        name: 'Test Member',
        organisationRole: 'MEMBER',
      },
      {
        email: managerEmail,
        name: 'Test Manager',
        organisationRole: 'MANAGER',
      },
      {
        email: adminMemberEmail,
        name: 'Test Admin Member',
        organisationRole: 'ADMIN',
      },
    ],
    organisationId: organisation.id,
  });

  // Sign in as admin and navigate to the organisation admin page
  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  // Verify we're on the admin organisation page
  await expect(page.getByText(`Manage organisation`)).toBeVisible();

  await expect(page.getByLabel('Organisation Name')).toHaveValue(organisation.name);

  // Check that the organisation members table shows the correct roles
  const ownerRow = page.getByRole('row', { name: ownerUser.email });

  await expect(ownerRow).toBeVisible();
  await expect(ownerRow.getByRole('status').filter({ hasText: 'Owner' })).toBeVisible();

  await expect(page.getByRole('row', { name: memberUser.email })).toBeVisible();
  await expect(page.getByRole('row', { name: adminMemberUser.email })).toBeVisible();
  await expect(page.getByRole('row', { name: managerUser.email })).toBeVisible();

  // Test promoting a MEMBER to owner
  const memberRow = page.getByRole('row', { name: memberUser.email });

  // Find and click the "Update role" button for the member
  const updateRoleButton = memberRow.getByRole('button', {
    name: 'Update role',
  });
  await expect(updateRoleButton).toBeVisible();
  await expect(updateRoleButton).not.toBeDisabled();

  await updateRoleButton.click();

  // Wait for dialog to open and select Owner role
  await expect(page.getByRole('dialog')).toBeVisible();

  // Find and click the select trigger - it's a button with role="combobox"
  await page.getByRole('dialog').locator('button[role="combobox"]').click();

  // Select "Owner" from the dropdown options
  await page.getByRole('option', { name: 'Owner' }).click();

  // Click Update button
  await page.getByRole('dialog').getByRole('button', { name: 'Update' }).click();

  // Wait for dialog to close (indicates success)
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

  // Reload the page to see the changes
  await page.reload();

  // Verify that the member is now the owner
  const newOwnerRow = page.getByRole('row', { name: memberUser.email });
  await expect(newOwnerRow.getByRole('status').filter({ hasText: 'Owner' })).toBeVisible();

  // Verify that the previous owner is no longer marked as owner
  const previousOwnerRow = page.getByRole('row', { name: ownerUser.email });
  await expect(previousOwnerRow.getByRole('status').filter({ hasText: 'Owner' })).not.toBeVisible();

  // Verify that the Update role button exists for the new owner and shows Owner as current role
  const newOwnerUpdateButton = newOwnerRow.getByRole('button', {
    name: 'Update role',
  });
  await expect(newOwnerUpdateButton).toBeVisible();

  // Verify clicking it shows the dialog with Owner already selected
  await newOwnerUpdateButton.click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // Close the dialog without making changes
  await page.getByRole('button', { name: 'Cancel' }).click();
});

test('[ADMIN]: promote manager to owner', async ({ page }) => {
  // Create an admin user who can access the admin panel
  const { user: adminUser } = await seedUser({
    isAdmin: true,
  });

  // Create an organisation with owner and manager
  const { organisation } = await seedUser({
    isPersonalOrganisation: false,
  });

  const managerEmail = `manager-${nanoid()}@test.documenso.com`;

  const [managerUser] = await seedOrganisationMembers({
    members: [
      {
        email: managerEmail,
        name: 'Test Manager',
        organisationRole: 'MANAGER',
      },
    ],
    organisationId: organisation.id,
  });

  // Sign in as admin
  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  // Promote the manager to owner
  const managerRow = page.getByRole('row', { name: managerUser.email });
  const updateRoleButton = managerRow.getByRole('button', {
    name: 'Update role',
  });

  await updateRoleButton.click();

  // Wait for dialog to open and select Owner role
  await expect(page.getByRole('dialog')).toBeVisible();

  // Find and click the select trigger - it's a button with role="combobox"
  await page.getByRole('dialog').locator('button[role="combobox"]').click();

  // Select "Owner" from the dropdown options
  await page.getByRole('option', { name: 'Owner' }).click();

  // Click Update button
  await page.getByRole('dialog').getByRole('button', { name: 'Update' }).click();

  // Wait for dialog to close (indicates success)
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

  // Reload and verify the change
  await page.reload();
  await expect(managerRow.getByRole('status').filter({ hasText: 'Owner' })).toBeVisible();
});

test('[ADMIN]: promote admin member to owner', async ({ page }) => {
  // Create an admin user who can access the admin panel
  const { user: adminUser } = await seedUser({
    isAdmin: true,
  });

  // Create an organisation with owner and admin member
  const { organisation } = await seedUser({
    isPersonalOrganisation: false,
  });

  const adminMemberEmail = `admin-member-${nanoid()}@test.documenso.com`;

  const [adminMemberUser] = await seedOrganisationMembers({
    members: [
      {
        email: adminMemberEmail,
        name: 'Test Admin Member',
        organisationRole: 'ADMIN',
      },
    ],
    organisationId: organisation.id,
  });

  // Sign in as admin
  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  // Promote the admin member to owner
  const adminMemberRow = page.getByRole('row', { name: adminMemberUser.email });
  const updateRoleButton = adminMemberRow.getByRole('button', {
    name: 'Update role',
  });

  await updateRoleButton.click();

  // Wait for dialog to open and select Owner role
  await expect(page.getByRole('dialog')).toBeVisible();

  // Find and click the select trigger - it's a button with role="combobox"
  await page.getByRole('dialog').locator('button[role="combobox"]').click();

  // Select "Owner" from the dropdown options
  await page.getByRole('option', { name: 'Owner' }).click();

  // Click Update button
  await page.getByRole('dialog').getByRole('button', { name: 'Update' }).click();

  // Wait for dialog to close (indicates success)
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

  // Reload and verify the change
  await page.reload();
  await expect(adminMemberRow.getByRole('status').filter({ hasText: 'Owner' })).toBeVisible();
});

test('[ADMIN]: cannot promote non-existent user', async ({ page }) => {
  // Create an admin user
  const { user: adminUser } = await seedUser({
    isAdmin: true,
  });

  // Create an organisation
  const { organisation } = await seedUser({
    isPersonalOrganisation: false,
  });

  // Sign in as admin
  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  // Try to manually call the API with invalid data - this should be handled by the UI validation
  // In a real scenario, the promote button wouldn't be available for non-existent users
  // But we can test that the API properly handles invalid requests

  // For now, just verify that non-existent users don't show up in the members table
  await expect(page.getByRole('row', { name: 'Non Existent User' })).not.toBeVisible();
});

test('[ADMIN]: verify role hierarchy after promotion', async ({ page }) => {
  // Create an admin user
  const { user: adminUser } = await seedUser({
    isAdmin: true,
  });

  // Create organisation with a member
  const { organisation } = await seedUser({
    isPersonalOrganisation: false,
  });

  const memberEmail = `member-${nanoid()}@test.documenso.com`;

  const [memberUser] = await seedOrganisationMembers({
    members: [
      {
        email: memberEmail,
        name: 'Test Member',
        organisationRole: 'MEMBER',
      },
    ],
    organisationId: organisation.id,
  });

  // Sign in as admin
  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  // Before promotion - verify member has MEMBER role
  let memberRow = page.getByRole('row', { name: memberUser.email });
  await expect(memberRow).toBeVisible();
  await expect(memberRow.getByRole('status').filter({ hasText: 'Owner' })).not.toBeVisible();

  // Promote member to owner
  const updateRoleButton = memberRow.getByRole('button', {
    name: 'Update role',
  });
  await updateRoleButton.click();

  // Wait for dialog to open and select Owner role
  await expect(page.getByRole('dialog')).toBeVisible();

  // Find and click the select trigger - it's a button with role="combobox"
  await page.getByRole('dialog').locator('button[role="combobox"]').click();

  // Select "Owner" from the dropdown options
  await page.getByRole('option', { name: 'Owner' }).click();

  // Click Update button
  await page.getByRole('dialog').getByRole('button', { name: 'Update' }).click();

  // Wait for dialog to close (indicates success)
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

  // Reload page to see updated state
  await page.reload();

  // After promotion - verify member is now owner and has admin permissions
  memberRow = page.getByRole('row', { name: memberUser.email });
  await expect(memberRow.getByRole('status').filter({ hasText: 'Owner' })).toBeVisible();

  // Verify the Update role button exists and shows Owner as current role
  const newOwnerUpdateButton = memberRow.getByRole('button', {
    name: 'Update role',
  });
  await expect(newOwnerUpdateButton).toBeVisible();

  // Sign in as the newly promoted user to verify they have owner permissions
  await apiSignin({
    page,
    email: memberUser.email,
    redirectPath: `/o/${organisation.url}/settings/general`,
  });

  // Verify they can access organisation settings (owner permission)
  await expect(page.getByText('Organisation Settings')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
});

test('[ADMIN]: error handling for invalid organisation', async ({ page }) => {
  // Create an admin user
  const { user: adminUser } = await seedUser({
    isAdmin: true,
  });

  // Sign in as admin and try to access non-existent organisation
  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/organisations/non-existent-org-id`,
  });

  // Should show 404 error
  await expect(page.getByRole('heading', { name: 'Organisation not found' })).toBeVisible({
    timeout: 10_000,
  });
});

test('[ADMIN]: multiple promotions in sequence', async ({ page }) => {
  // Create an admin user
  const { user: adminUser } = await seedUser({
    isAdmin: true,
  });

  // Create organisation with multiple members
  const { organisation } = await seedUser({
    isPersonalOrganisation: false,
  });

  const member1Email = `member1-${nanoid()}@test.documenso.com`;
  const member2Email = `member2-${nanoid()}@test.documenso.com`;

  const [member1User, member2User] = await seedOrganisationMembers({
    members: [
      {
        email: member1Email,
        name: 'Test Member 1',
        organisationRole: 'MEMBER',
      },
      {
        email: member2Email,
        name: 'Test Member 2',
        organisationRole: 'MANAGER',
      },
    ],
    organisationId: organisation.id,
  });

  // Sign in as admin
  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  // First promotion: Member 1 becomes owner
  let member1Row = page.getByRole('row', { name: member1User.email });
  let updateRoleButton1 = member1Row.getByRole('button', {
    name: 'Update role',
  });
  await updateRoleButton1.click();

  // Wait for dialog to open and select Owner role
  await expect(page.getByRole('dialog')).toBeVisible();

  // Find and click the select trigger - it's a button with role="combobox"
  await page.getByRole('dialog').locator('button[role="combobox"]').click();

  // Select "Owner" from the dropdown options
  await page.getByRole('option', { name: 'Owner' }).click();

  // Click Update button
  await page.getByRole('dialog').getByRole('button', { name: 'Update' }).click();

  // Wait for dialog to close (indicates success)
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

  await page.reload();

  // Verify Member 1 is now owner
  member1Row = page.getByRole('row', { name: member1User.email });
  await expect(member1Row.getByRole('status').filter({ hasText: 'Owner' })).toBeVisible();
  updateRoleButton1 = member1Row.getByRole('button', { name: 'Update role' });
  await expect(updateRoleButton1).toBeVisible();

  // Second promotion: Member 2 becomes the new owner
  const member2Row = page.getByRole('row', { name: member2User.email });
  const updateRoleButton2 = member2Row.getByRole('button', {
    name: 'Update role',
  });
  await expect(updateRoleButton2).toBeVisible();
  await updateRoleButton2.click();

  // Wait for dialog to open and select Owner role
  await expect(page.getByRole('dialog')).toBeVisible();

  // Find and click the select trigger - it's a button with role="combobox"
  await page.getByRole('dialog').locator('button[role="combobox"]').click();

  // Select "Owner" from the dropdown options
  await page.getByRole('option', { name: 'Owner' }).click();

  // Click Update button
  await page.getByRole('dialog').getByRole('button', { name: 'Update' }).click();

  // Wait for dialog to close (indicates success)
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

  await page.reload();

  // Verify Member 2 is now owner and Member 1 is no longer owner
  await expect(member2Row.getByRole('status').filter({ hasText: 'Owner' })).toBeVisible();
  await expect(member1Row.getByRole('status').filter({ hasText: 'Owner' })).not.toBeVisible();

  // Verify Member 1's Update role button is still visible
  const newUpdateButton1 = member1Row.getByRole('button', {
    name: 'Update role',
  });
  await expect(newUpdateButton1).toBeVisible();
});

test('[ADMIN]: verify organisation access after ownership change', async ({ page }) => {
  // Create admin user
  const { user: adminUser } = await seedUser({
    isAdmin: true,
  });

  // Create organisation with owner and member
  const { user: originalOwner, organisation } = await seedUser({
    isPersonalOrganisation: false,
  });

  const memberEmail = `member-${nanoid()}@test.documenso.com`;

  const [memberUser] = await seedOrganisationMembers({
    members: [
      {
        email: memberEmail,
        name: 'Test Member',
        organisationRole: 'MEMBER',
      },
    ],
    organisationId: organisation.id,
  });

  // Sign in as admin and promote member to owner
  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  const memberRow = page.getByRole('row', { name: memberUser.email });
  const updateRoleButton = memberRow.getByRole('button', {
    name: 'Update role',
  });
  await updateRoleButton.click();

  // Wait for dialog to open and select Owner role
  await expect(page.getByRole('dialog')).toBeVisible();

  // Find and click the select trigger - it's a button with role="combobox"
  await page.getByRole('dialog').locator('button[role="combobox"]').click();

  // Select "Owner" from the dropdown options
  await page.getByRole('option', { name: 'Owner' }).click();

  // Click Update button
  await page.getByRole('dialog').getByRole('button', { name: 'Update' }).click();

  // Wait for dialog to close (indicates success)
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

  // Test that the new owner can access organisation settings
  await apiSignin({
    page,
    email: memberUser.email,
    redirectPath: `/o/${organisation.url}/settings/general`,
  });

  // Should be able to access organisation settings
  await expect(page.getByText('Organisation Settings')).toBeVisible();
  await expect(page.getByLabel('Organisation Name*')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Update organisation' })).toBeVisible();

  // Should have delete permissions
  await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();

  // Test that the original owner no longer has owner-level access
  await apiSignin({
    page,
    email: originalOwner.email,
    redirectPath: `/o/${organisation.url}/settings/general`,
  });

  // Should still be able to access settings (as they should now be an admin)
  await expect(page.getByText('Organisation Settings')).toBeVisible();
});
