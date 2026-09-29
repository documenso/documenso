import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { prisma } from '@documenso/prisma';
import { AnonymousVerificationTokenType, FieldType } from '@documenso/prisma/client';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'parallel' });

/**
 * Draw a zig-zag onto the drawing canvas so that it passes the minimum
 * signature coverage threshold.
 */
const drawOnSignaturePad = async (page: Page) => {
  const canvas = page.getByTestId('signature-pad-draw');

  await canvas.waitFor({ state: 'visible' });

  let capturedBox: { x: number; y: number; width: number; height: number } | null = null;

  // `boundingBox()` can return null if the canvas is replaced mid-hydration,
  // so poll until a measurable element is attached, capturing the box inside
  // the retry closure so it is never re-fetched (and re-raced) afterwards.
  await expect(async () => {
    capturedBox = await canvas.boundingBox();

    expect(capturedBox).not.toBeNull();
    expect(capturedBox?.width ?? 0).toBeGreaterThan(0);
  }).toPass({ timeout: 5_000 });

  // TS cannot see the closure assignment above, so widen the type back out.
  const box = capturedBox as { x: number; y: number; width: number; height: number } | null;

  if (!box) {
    throw new Error('Signature pad canvas not found');
  }

  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.5);
  await page.mouse.down();

  for (let i = 0; i < 8; i++) {
    await page.mouse.move(box.x + box.width * (0.15 + i * 0.09), box.y + box.height * (i % 2 === 0 ? 0.25 : 0.75), {
      steps: 10,
    });
  }

  await page.mouse.up();
};

test('[QR_SIGNATURE]: complete signing via mobile qr handoff', async ({ page, browser }) => {
  const { user, team } = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    recipients: ['qr-signer@test.documenso.com'],
    teamId: team.id,
    fields: [FieldType.SIGNATURE],
  });

  const recipient = recipients[0];

  await page.goto(`/sign/${recipient.token}`);

  // Wait for the client-side PDF render so we know the page has hydrated
  // before interacting with the signature pad.
  await page.waitForSelector(PDF_VIEWER_PAGE_SELECTOR);

  // Open the signature dialog and switch to the Mobile tab.
  await page.getByTestId('signature-pad-dialog-button').click();
  await page.getByRole('tab', { name: 'Mobile' }).click();

  // Read the handoff URL rendered beneath the QR code.
  await expect(page.getByTestId('signature-pad-qr-url')).toBeVisible();
  const handoffUrl = await page.getByTestId('signature-pad-qr-url').textContent();

  expect(handoffUrl).toContain('/mobile-signature/');

  // Open the mobile page in a fully isolated browser context (no shared
  // cookies or session) to prove the handoff requires no authentication.
  // A realistic landscape-phone viewport: the pad sizes itself dynamically to
  // the viewport, and the primitive's minimum-coverage check is a percentage
  // of the canvas area - a desktop-sized context would demand far more ink
  // than the drawn zigzag provides.
  const mobileContext = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto(handoffUrl ?? '');

  // The phone page renders the signing card (landscape layout at the default
  // test viewport) with Next disabled until a valid signature is drawn.
  await expect(mobilePage.getByTestId('signature-pad-draw')).toBeVisible();
  await expect(mobilePage.getByRole('button', { name: 'Next' })).toBeDisabled();

  await drawOnSignaturePad(mobilePage);

  await mobilePage.getByRole('button', { name: 'Next' }).click();

  await expect(mobilePage.getByText('Success')).toBeVisible();

  await mobileContext.close();

  // The desktop pad should receive the signature within a poll interval.
  await expect(page.getByTestId('signature-pad-qr-preview')).toBeVisible({ timeout: 10_000 });

  // The session is single-use: the desktop pickup deletes the row on read, and
  // a missing row is indistinguishable from an expired one by design. So a
  // revisit must show the expired page (not "Signature already sent"), which
  // proves the deletion happened.
  const revisitContext = await browser.newContext();
  const revisitPage = await revisitContext.newPage();

  await revisitPage.goto(handoffUrl ?? '');

  await expect(revisitPage.getByRole('heading', { name: 'This link has expired' })).toBeVisible();

  await revisitContext.close();

  // Direct proof of consumption: the token row must be gone from the database.
  const consumedToken = (handoffUrl ?? '').split('/mobile-signature/')[1];

  const consumedRow = await prisma.anonymousVerificationToken.findFirst({
    where: { token: consumedToken },
  });

  expect(consumedRow).toBeNull();

  // Confirm and finish signing the document.
  await page.getByRole('button', { name: 'Next' }).click();

  await page.locator('[data-field-type="SIGNATURE"]:not([data-readonly="true"])').first().click();

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click();

  await page.waitForURL(`/sign/${recipient.token}/complete`);
  await expect(page.getByText('Document Signed')).toBeVisible();
});

test('[QR_SIGNATURE]: mobile tab hidden when qr disabled', async ({ page }) => {
  const { user, team } = await seedUser();

  const { document, recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    recipients: ['qr-disabled-signer@test.documenso.com'],
    teamId: team.id,
    fields: [FieldType.SIGNATURE],
  });

  // Seeded documents create their meta row with bare column defaults, which
  // leave qrSignatureEnabled true, so disable it directly on the meta row.
  await prisma.documentMeta.update({
    where: { id: document.documentMetaId },
    data: { qrSignatureEnabled: false },
  });

  const recipient = recipients[0];

  await page.goto(`/sign/${recipient.token}`);

  await page.waitForSelector(PDF_VIEWER_PAGE_SELECTOR);

  await page.getByTestId('signature-pad-dialog-button').click();

  // Waiting on the Draw tab first guarantees the tab list has rendered before
  // asserting the Mobile tab is absent.
  await expect(page.getByRole('tab', { name: 'Draw' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Mobile' })).not.toBeVisible();
});

test('[QR_SIGNATURE]: mobile tab shown when draw disabled but qr enabled', async ({ page }) => {
  const { user, team } = await seedUser();

  const { document, recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    recipients: ['qr-only-signer@test.documenso.com'],
    teamId: team.id,
    fields: [FieldType.SIGNATURE],
  });

  // qrSignatureEnabled already defaults to true on seeded metas, but set it
  // explicitly so the test still documents the required state if defaults change.
  await prisma.documentMeta.update({
    where: { id: document.documentMetaId },
    data: { drawSignatureEnabled: false, qrSignatureEnabled: true },
  });

  const recipient = recipients[0];

  await page.goto(`/sign/${recipient.token}`);

  await page.waitForSelector(PDF_VIEWER_PAGE_SELECTOR);

  await page.getByTestId('signature-pad-dialog-button').click();

  await expect(page.getByRole('tab', { name: 'Mobile' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Draw' })).not.toBeVisible();
});

test('[QR_SIGNATURE]: unknown token shows expired page', async ({ page }) => {
  await page.goto('/mobile-signature/this-token-does-not-exist');

  await expect(page.getByRole('heading', { name: 'This link has expired' })).toBeVisible();
});

test('[QR_SIGNATURE]: expired token shows expired page', async ({ page }) => {
  const expiredToken = `qr-e2e-expired-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  await prisma.anonymousVerificationToken.create({
    data: {
      type: AnonymousVerificationTokenType.QR_SIGNATURE,
      token: expiredToken,
      expiresAt: new Date(Date.now() - 60_000),
    },
  });

  await page.goto(`/mobile-signature/${expiredToken}`);

  await expect(page.getByRole('heading', { name: 'This link has expired' })).toBeVisible();
});
