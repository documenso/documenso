import { expect, test } from '@playwright/test';

import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[BRANDING_LOGO_SIZE_API]: can update team branding logo size via tRPC', async ({ page }) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  // Update team branding settings via tRPC
  const updateResponse = await page
    .context()
    .request.post(`http://localhost:3001/api/trpc/team.settings.update`, {
      headers: {
        Cookie: await page
          .context()
          .cookies()
          .then((cookies) => {
            const cookieStr = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
            return cookieStr;
          }),
      },
      data: {
        json: {
          teamId: team.id,
          data: {
            brandingEnabled: true,
            brandingLogoSize: 'h-12',
          },
        },
      },
    });

  expect(updateResponse.ok()).toBeTruthy();

  // Verify the data is persisted in the database
  const updatedTeam = await prisma.team.findUnique({
    where: { id: team.id },
    include: { teamGlobalSettings: true },
  });

  expect(updatedTeam?.teamGlobalSettings?.brandingLogoSize).toBe('h-12');
  expect(updatedTeam?.teamGlobalSettings?.brandingEnabled).toBe(true);
});

test('[BRANDING_LOGO_SIZE_API]: can update organization branding logo size via tRPC', async ({
  page,
}) => {
  const { user, organisation } = await seedUser({
    roles: {
      organisationRole: 'ADMIN',
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/documents`,
  });

  // Update organization branding settings via tRPC
  const updateResponse = await page
    .context()
    .request.post(`http://localhost:3001/api/trpc/organisation.settings.update`, {
      headers: {
        Cookie: await page
          .context()
          .cookies()
          .then((cookies) => {
            const cookieStr = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
            return cookieStr;
          }),
      },
      data: {
        json: {
          organisationId: organisation.id,
          data: {
            brandingEnabled: true,
            brandingLogoSize: 'h-8',
          },
        },
      },
    });

  expect(updateResponse.ok()).toBeTruthy();

  // Verify the data is persisted in the database
  const updatedOrganisation = await prisma.organisation.findUnique({
    where: { id: organisation.id },
    include: { organisationGlobalSettings: true },
  });

  expect(updatedOrganisation?.organisationGlobalSettings?.brandingLogoSize).toBe('h-8');
  expect(updatedOrganisation?.organisationGlobalSettings?.brandingEnabled).toBe(true);
});

test('[BRANDING_LOGO_SIZE_API]: team can update through multiple size options', async ({
  page,
}) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  const sizes = ['h-6', 'h-8', 'h-12', 'h-16'];

  for (const size of sizes) {
    const updateResponse = await page
      .context()
      .request.post(`http://localhost:3001/api/trpc/team.settings.update`, {
        headers: {
          Cookie: await page
            .context()
            .cookies()
            .then((cookies) => {
              const cookieStr = cookies
                .map((cookie) => `${cookie.name}=${cookie.value}`)
                .join('; ');
              return cookieStr;
            }),
        },
        data: {
          json: {
            teamId: team.id,
            data: {
              brandingLogoSize: size,
            },
          },
        },
      });

    expect(updateResponse.ok()).toBeTruthy();

    // Verify each size is correctly saved
    const updatedTeam = await prisma.team.findUnique({
      where: { id: team.id },
      include: { teamGlobalSettings: true },
    });

    expect(updatedTeam?.teamGlobalSettings?.brandingLogoSize).toBe(size);
  }
});

test('[BRANDING_LOGO_SIZE_API]: organization can update through multiple size options', async ({
  page,
}) => {
  const { user, organisation } = await seedUser({
    roles: {
      organisationRole: 'ADMIN',
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/documents`,
  });

  const sizes = ['h-6', 'h-8', 'h-12', 'h-16'];

  for (const size of sizes) {
    const updateResponse = await page
      .context()
      .request.post(`http://localhost:3001/api/trpc/organisation.settings.update`, {
        headers: {
          Cookie: await page
            .context()
            .cookies()
            .then((cookies) => {
              const cookieStr = cookies
                .map((cookie) => `${cookie.name}=${cookie.value}`)
                .join('; ');
              return cookieStr;
            }),
        },
        data: {
          json: {
            organisationId: organisation.id,
            data: {
              brandingLogoSize: size,
            },
          },
        },
      });

    expect(updateResponse.ok()).toBeTruthy();

    // Verify each size is correctly saved
    const updatedOrganisation = await prisma.organisation.findUnique({
      where: { id: organisation.id },
      include: { organisationGlobalSettings: true },
    });

    expect(updatedOrganisation?.organisationGlobalSettings?.brandingLogoSize).toBe(size);
  }
});

test('[BRANDING_LOGO_SIZE_API]: can clear team branding logo size', async ({ page }) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  // First set a size
  await prisma.team.update({
    where: { id: team.id },
    data: {
      teamGlobalSettings: {
        update: {
          brandingLogoSize: 'h-12',
        },
      },
    },
  });

  // Now clear it via tRPC
  const updateResponse = await page
    .context()
    .request.post(`http://localhost:3001/api/trpc/team.settings.update`, {
      headers: {
        Cookie: await page
          .context()
          .cookies()
          .then((cookies) => {
            const cookieStr = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
            return cookieStr;
          }),
      },
      data: {
        json: {
          teamId: team.id,
          data: {
            brandingLogoSize: null,
          },
        },
      },
    });

  expect(updateResponse.ok()).toBeTruthy();

  // Verify it's cleared
  const updatedTeam = await prisma.team.findUnique({
    where: { id: team.id },
    include: { teamGlobalSettings: true },
  });

  expect(updatedTeam?.teamGlobalSettings?.brandingLogoSize).toBeNull();
});
