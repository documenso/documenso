import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../fixtures/authentication';

test('[LEGACY_EDITOR]: document legacy editor redirects to the V2 envelope', async ({ page }) => {
  const { user, team } = await seedUser();

  const envelope = await seedBlankDocument(user, team.id, { internalVersion: 2 });

  await apiSignin({ page, email: user.email });

  // `page.goto` follows redirects and would report the destination's 200, so
  // assert the redirect itself through the (cookie-sharing) request context.
  const response = await page.request.get(`/t/${team.url}/documents/${envelope.id}/legacy_editor`, {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(302);
  expect(response.headers().location).toContain(`/t/${team.url}/documents/${envelope.id}/edit`);
});

test('[LEGACY_EDITOR]: template legacy editor redirects to the V2 envelope', async ({ page }) => {
  const { user, team } = await seedUser();

  const envelope = await seedBlankTemplate(user, team.id, {
    createTemplateOptions: { internalVersion: 2 },
  });

  await apiSignin({ page, email: user.email });

  // `page.goto` follows redirects and would report the destination's 200, so
  // assert the redirect itself through the (cookie-sharing) request context.
  const response = await page.request.get(`/t/${team.url}/templates/${envelope.id}/legacy_editor`, {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(302);
  expect(response.headers().location).toContain(`/t/${team.url}/templates/${envelope.id}/edit`);
});

test('[LEGACY_EDITOR]: document legacy editor still loads a V1 envelope', async ({ page }) => {
  const { user, team } = await seedUser();

  const envelope = await seedBlankDocument(user, team.id, { internalVersion: 1 });

  await apiSignin({ page, email: user.email });

  const response = await page.goto(`/t/${team.url}/documents/${envelope.id}/legacy_editor`);

  expect(response?.status()).toBe(200);
});

test('[LEGACY_EDITOR]: template legacy editor still loads a V1 envelope', async ({ page }) => {
  const { user, team } = await seedUser();

  const envelope = await seedBlankTemplate(user, team.id, {
    createTemplateOptions: { internalVersion: 1 },
  });

  await apiSignin({ page, email: user.email });

  const response = await page.goto(`/t/${team.url}/templates/${envelope.id}/legacy_editor`);

  expect(response?.status()).toBe(200);
});
