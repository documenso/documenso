import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';

import {
  type TEnvelopeEditorSurface,
  addEnvelopeItemPdf,
  createEmbeddedEnvelopeCreateHash,
  getEnvelopeEditorSettingsTrigger,
  openEmbeddedEnvelopeEditor,
  persistEmbeddedEnvelope,
  setRecipientEmail,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';

const TEST_CSS_VARS = {
  background: '#ff0000',
  primary: '#00ff00',
  radius: '1rem',
};

/**
 * A unique CSS selector used for asserting raw CSS injection.
 */
const TEST_RAW_CSS = '.e2e-css-test-marker { color: red; }';

/**
 * Expected HSL values after conversion by `toNativeCssVars`:
 * - colord('#ff0000').toHsl() → { h: 0, s: 100, l: 50 }
 * - colord('#00ff00').toHsl() → { h: 120, s: 100, l: 50 }
 */
const EXPECTED_CSS_VARS = {
  '--background': '0 100 50',
  '--primary': '120 100 50',
  '--radius': '1rem',
};

const enableEmbedAuthoringWhiteLabel = async (userId: number) => {
  const organisation = await prisma.organisation.findFirstOrThrow({
    where: { ownerUserId: userId },
    include: { organisationClaim: true },
  });

  await prisma.organisationClaim.update({
    where: { id: organisation.organisationClaim.id },
    data: {
      flags: {
        allowLegacyEnvelopes: true,
        embedAuthoringWhiteLabel: true,
      },
    },
  });
};

/**
 * The default background color from the theme before any CSS injection.
 *
 * The theme default `--background: 0 0% 100%` resolves to hsl(0, 0%, 100%) which is white.
 */
const DEFAULT_BODY_BG_COLOR = 'rgb(255, 255, 255)';

/**
 * When `--background` is set to `0 100 50` (hsl(0, 100%, 50%)) the body background
 * resolves to pure red via the Tailwind `bg-background` → `hsl(var(--background))` chain.
 */
const INJECTED_BODY_BG_COLOR = 'rgb(255, 0, 0)';

const assertCssNotInjected = async (surface: TEnvelopeEditorSurface) => {
  const { root: page } = surface;

  const cssState = await page.evaluate(() => {
    const rootStyle = document.documentElement.style;
    const bodyBgColor = window.getComputedStyle(document.body).backgroundColor;

    return {
      background: rootStyle.getPropertyValue('--background'),
      primary: rootStyle.getPropertyValue('--primary'),
      radius: rootStyle.getPropertyValue('--radius'),
      bodyBgColor,
      hasInjectedStyle: Array.from(document.head.querySelectorAll('style')).some((el) =>
        el.innerHTML.includes('.e2e-css-test-marker'),
      ),
    };
  });

  // CSS custom properties should not be set on the inline style.
  expect(cssState.background).toBe('');
  expect(cssState.primary).toBe('');
  expect(cssState.radius).toBe('');

  // No raw CSS style tag should be injected.
  expect(cssState.hasInjectedStyle).toBe(false);

  // The body should still use the default theme background color.
  expect(cssState.bodyBgColor).toBe(DEFAULT_BODY_BG_COLOR);
};

const assertCssInjected = async (surface: TEnvelopeEditorSurface) => {
  const { root: page } = surface;

  const cssState = await page.evaluate(() => {
    const rootStyle = document.documentElement.style;
    const bodyBgColor = window.getComputedStyle(document.body).backgroundColor;

    return {
      background: rootStyle.getPropertyValue('--background'),
      primary: rootStyle.getPropertyValue('--primary'),
      radius: rootStyle.getPropertyValue('--radius'),
      bodyBgColor,
      hasInjectedStyle: Array.from(document.head.querySelectorAll('style')).some((el) =>
        el.innerHTML.includes('.e2e-css-test-marker'),
      ),
    };
  });

  // CSS custom properties should be set to the expected HSL values.
  expect(cssState.background).toBe(EXPECTED_CSS_VARS['--background']);
  expect(cssState.primary).toBe(EXPECTED_CSS_VARS['--primary']);
  expect(cssState.radius).toBe(EXPECTED_CSS_VARS['--radius']);

  // Raw CSS style tag should be injected.
  expect(cssState.hasInjectedStyle).toBe(true);

  // The body background should reflect the injected --background value (red).
  expect(cssState.bodyBgColor).toBe(INJECTED_BODY_BG_COLOR);
};

const assertDarkModeDisabled = async (surface: TEnvelopeEditorSurface) => {
  const { root: page } = surface;

  const hasDarkModeDisabled = await page.evaluate(() =>
    document.documentElement.classList.contains('dark-mode-disabled'),
  );

  expect(hasDarkModeDisabled).toBe(true);
};

/**
 * Open an embedded create editor with a pre-seeded user. This is needed for folderId
 * tests where the folder must exist before the hash is built.
 */
const openEmbeddedCreateWithUser = async (
  page: Page,
  user: { id: number; email: string; name: string | null },
  team: { id: number },
  options: { folderId?: string; tokenNamePrefix?: string },
): Promise<TEnvelopeEditorSurface> => {
  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: `${options.tokenNamePrefix ?? 'e2e-embed-folder'}-document`,
    expiresIn: null,
  });

  // Exchange API token for presign token.
  const response = await page
    .context()
    .request.post(`${NEXT_PUBLIC_WEBAPP_URL()}/api/v2/embedding/create-presign-token`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {},
    });

  const data: unknown = await response.json();

  if (typeof data !== 'object' || data === null || !('token' in data)) {
    throw new Error(`Unexpected presign response: ${JSON.stringify(data)}`);
  }

  const presignToken = data.token;

  if (typeof presignToken !== 'string' || presignToken.length === 0) {
    throw new Error(`Unexpected presign response: ${JSON.stringify(data)}`);
  }

  const hash = createEmbeddedEnvelopeCreateHash({
    envelopeType: 'DOCUMENT',
    folderId: options.folderId,
  });

  await page.goto(
    `/embed/v2/authoring/envelope/create?token=${encodeURIComponent(presignToken)}#${hash}`,
  );

  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

  return {
    root: page,
    isEmbedded: true,
    envelopeType: 'DOCUMENT',
    userId: user.id,
    userEmail: user.email,
    userName: user.name ?? '',
    teamId: team.id,
  };
};

/**
 * Helper to set an external ID on the envelope via the settings dialog so we can
 * look it up in the database after creation.
 */
const setExternalIdViaSettings = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  await getEnvelopeEditorSettingsTrigger(surface.root).click();
  await expect(surface.root.getByRole('heading', { name: 'Document Settings' })).toBeVisible();

  await surface.root.locator('input[name="externalId"]').fill(externalId);
  await surface.root.getByRole('button', { name: 'Update' }).click();
};

/**
 * Minimal setup for an embedded create flow: upload a PDF and add a recipient
 * so the "Create Document" button works.
 */
const setupMinimalEnvelope = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  await addEnvelopeItemPdf(surface.root);
  await setRecipientEmail(surface.root, 0, `${nanoid()}@test.documenso.com`);
  await setExternalIdViaSettings(surface, externalId);
};

/**
 * Click "Create Document" and expect a failure toast instead of the success heading.
 */
const expectCreateToFail = async (surface: TEnvelopeEditorSurface) => {
  const actionButtonName =
    surface.envelopeType === 'DOCUMENT' ? 'Create Document' : 'Create Template';

  await surface.root.getByRole('button', { name: actionButtonName }).click();
  await expectToastTextToBeVisible(surface.root, 'Failed to create document');
};

test.describe('embedded create - folderId', () => {
  test('creates envelope in the specified folder when folderId is provided', async ({ page }) => {
    const { user, team } = await seedUser();

    const folder = await prisma.folder.create({
      data: {
        name: 'E2E Document Folder',
        teamId: team.id,
        userId: user.id,
        type: 'DOCUMENT',
      },
    });

    const surface = await openEmbeddedCreateWithUser(page, user, team, {
      folderId: folder.id,
      tokenNamePrefix: 'e2e-embed-folder',
    });

    const externalId = `e2e-folder-create-${nanoid()}`;

    await setupMinimalEnvelope(surface, externalId);
    await persistEmbeddedEnvelope(surface);

    const envelope = await prisma.envelope.findFirstOrThrow({
      where: {
        externalId,
        userId: surface.userId,
        teamId: surface.teamId,
      },
    });

    expect(envelope.folderId).toBe(folder.id);
  });

  test('creates envelope in root folder when no folderId is provided', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      mode: 'create',
      tokenNamePrefix: 'e2e-embed-folder-none',
    });

    const externalId = `e2e-folder-root-${nanoid()}`;

    await setupMinimalEnvelope(surface, externalId);
    await persistEmbeddedEnvelope(surface);

    const envelope = await prisma.envelope.findFirstOrThrow({
      where: {
        externalId,
        userId: surface.userId,
        teamId: surface.teamId,
      },
    });

    expect(envelope.folderId).toBeNull();
  });

  test('rejects creation when folderId has wrong folder type', async ({ page }) => {
    const { user, team } = await seedUser();

    // Create a TEMPLATE folder but attempt to create a DOCUMENT envelope in it.
    const templateFolder = await prisma.folder.create({
      data: {
        name: 'E2E Template Folder',
        teamId: team.id,
        userId: user.id,
        type: 'TEMPLATE',
      },
    });

    const surface = await openEmbeddedCreateWithUser(page, user, team, {
      folderId: templateFolder.id,
      tokenNamePrefix: 'e2e-embed-folder-wrong-type',
    });

    const externalId = `e2e-folder-wrong-type-${nanoid()}`;

    await setupMinimalEnvelope(surface, externalId);
    await expectCreateToFail(surface);

    // Verify no envelope was created with this externalId.
    const count = await prisma.envelope.count({ where: { externalId } });
    expect(count).toBe(0);
  });

  test('rejects creation when folderId belongs to another team', async ({ page }) => {
    // Create the user who will use the embedded editor.
    const { user, team } = await seedUser();

    // Create a second user/team that owns the folder.
    const { user: otherUser, team: otherTeam } = await seedUser();

    const otherTeamFolder = await prisma.folder.create({
      data: {
        name: 'E2E Other Team Folder',
        teamId: otherTeam.id,
        userId: otherUser.id,
        type: 'DOCUMENT',
      },
    });

    // Open the embedded editor for the first user but pass the folder from the other team.
    const surface = await openEmbeddedCreateWithUser(page, user, team, {
      folderId: otherTeamFolder.id,
      tokenNamePrefix: 'e2e-embed-folder-no-perm',
    });

    const externalId = `e2e-folder-no-perm-${nanoid()}`;

    await setupMinimalEnvelope(surface, externalId);
    await expectCreateToFail(surface);

    // Verify no envelope was created with this externalId.
    const count = await prisma.envelope.count({ where: { externalId } });
    expect(count).toBe(0);
  });

  test('rejects creation when folderId does not exist', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      mode: 'create',
      tokenNamePrefix: 'e2e-embed-folder-nonexistent',
      folderId: 'nonexistent-folder-id',
    });

    const externalId = `e2e-folder-nonexistent-${nanoid()}`;

    await setupMinimalEnvelope(surface, externalId);
    await expectCreateToFail(surface);

    // Verify no envelope was created with this externalId.
    const count = await prisma.envelope.count({ where: { externalId } });
    expect(count).toBe(0);
  });
});

test.describe('embedded create', () => {
  test('cssVars and css respect embedAuthoringWhiteLabel flag', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      mode: 'create',
      tokenNamePrefix: 'e2e-embed-css',
      css: TEST_RAW_CSS,
      cssVars: TEST_CSS_VARS,
      darkModeDisabled: true,
    });

    // darkModeDisabled is applied regardless of the flag.
    await assertDarkModeDisabled(surface);

    // Flag is disabled by default so CSS should NOT be injected.
    await assertCssNotInjected(surface);

    // Enable the embedAuthoringWhiteLabel flag on the organisation claim.
    await enableEmbedAuthoringWhiteLabel(surface.userId);

    // Reload the page to re-run the layout loader with the updated claim.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

    // CSS should now be injected.
    await assertCssInjected(surface);

    // darkModeDisabled should still be applied after reload.
    await assertDarkModeDisabled(surface);
  });
});

test.describe('embedded edit', () => {
  test('cssVars and css respect embedAuthoringWhiteLabel flag', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-css',
      css: TEST_RAW_CSS,
      cssVars: TEST_CSS_VARS,
      darkModeDisabled: true,
    });

    // darkModeDisabled is applied regardless of the flag.
    await assertDarkModeDisabled(surface);

    // Flag is disabled by default so CSS should NOT be injected.
    await assertCssNotInjected(surface);

    // Enable the embedAuthoringWhiteLabel flag on the organisation claim.
    await enableEmbedAuthoringWhiteLabel(surface.userId);

    // Reload the page to re-run the layout loader with the updated claim.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

    // CSS should now be injected.
    await assertCssInjected(surface);

    // darkModeDisabled should still be applied after reload.
    await assertDarkModeDisabled(surface);
  });
});
