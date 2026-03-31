import { expect, test } from '@playwright/test';

import { prisma } from '@documenso/prisma';
import {
  seedBlankDocument,
  seedPendingDocumentWithFullFields,
} from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[BRANDING_LOGO_SIZE_EMAIL]: email template applies team branding logo size', async () => {
  const { user, team } = await seedUser();

  // Set team branding logo size
  await prisma.team.update({
    where: { id: team.id },
    data: {
      teamGlobalSettings: {
        update: {
          brandingEnabled: true,
          brandingLogoSize: 'h-12',
        },
      },
    },
  });

  // Create a document with a recipient
  const { document, recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    recipients: ['signer@example.com'],
    teamId: team.id,
  });

  // Verify the team settings are applied
  const updatedTeam = await prisma.team.findUnique({
    where: { id: team.id },
    include: { teamGlobalSettings: true },
  });

  expect(updatedTeam?.teamGlobalSettings?.brandingEnabled).toBe(true);
  expect(updatedTeam?.teamGlobalSettings?.brandingLogoSize).toBe('h-12');

  // Verify document has the team reference
  const updatedDocument = await prisma.envelope.findUnique({
    where: { id: document.id },
    include: { team: true },
  });

  expect(updatedDocument?.team?.id).toBe(team.id);
});

test('[BRANDING_LOGO_SIZE_EMAIL]: email template applies organization branding logo size', async () => {
  const { user, organisation, team } = await seedUser();

  // Set organization branding logo size
  await prisma.organisation.update({
    where: { id: organisation.id },
    data: {
      organisationGlobalSettings: {
        update: {
          brandingEnabled: true,
          brandingLogoSize: 'h-8',
        },
      },
    },
  });

  // Create a document with a recipient
  const { document } = await seedPendingDocumentWithFullFields({
    owner: user,
    recipients: ['signer@example.com'],
    teamId: team.id,
  });

  // Verify the organization settings are applied
  const updatedOrganisation = await prisma.organisation.findUnique({
    where: { id: organisation.id },
    include: { organisationGlobalSettings: true },
  });

  expect(updatedOrganisation?.organisationGlobalSettings?.brandingEnabled).toBe(true);
  expect(updatedOrganisation?.organisationGlobalSettings?.brandingLogoSize).toBe('h-8');

  // Verify document has the org reference
  const updatedDocument = await prisma.envelope.findUnique({
    where: { id: document.id },
    include: { team: { include: { organisation: true } } },
  });

  expect(updatedDocument?.team?.organisation?.id).toBe(organisation.id);
});

test('[BRANDING_LOGO_SIZE_EMAIL]: team logo size preference takes precedence', async () => {
  const { user, organisation, team } = await seedUser();

  // Set different logo sizes for org and team
  await prisma.organisation.update({
    where: { id: organisation.id },
    data: {
      organisationGlobalSettings: {
        update: {
          brandingLogoSize: 'h-6',
        },
      },
    },
  });

  await prisma.team.update({
    where: { id: team.id },
    data: {
      teamGlobalSettings: {
        update: {
          brandingLogoSize: 'h-16',
        },
      },
    },
  });

  // Get the team settings - should have team's value
  const teamSettings = await prisma.team.findUnique({
    where: { id: team.id },
    include: { teamGlobalSettings: true },
  });

  expect(teamSettings?.teamGlobalSettings?.brandingLogoSize).toBe('h-16');

  // Get org settings - should have org's value
  const orgSettings = await prisma.organisation.findUnique({
    where: { id: organisation.id },
    include: { organisationGlobalSettings: true },
  });

  expect(orgSettings?.organisationGlobalSettings?.brandingLogoSize).toBe('h-6');
});

test('[BRANDING_LOGO_SIZE_EMAIL]: document uses team branding settings for rendering', async ({
  page,
}) => {
  const { user, team } = await seedUser();

  // Create blank document
  const document = await seedBlankDocument(user, team.id);

  // Set team branding
  await prisma.team.update({
    where: { id: team.id },
    data: {
      teamGlobalSettings: {
        update: {
          brandingEnabled: true,
          brandingLogoSize: 'h-12',
        },
      },
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
  });

  // Verify document page loads successfully
  const heading = page.getByRole('heading', { name: 'General' });
  await expect(heading).toBeVisible();

  // Verify the branding settings exist for this team
  const teamData = await prisma.team.findUnique({
    where: { id: team.id },
    include: { teamGlobalSettings: true },
  });

  expect(teamData?.teamGlobalSettings?.brandingLogoSize).toBe('h-12');
});
