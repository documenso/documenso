import { expect, test } from '@playwright/test';

import { prisma } from '@documenso/prisma';

import {
  type TEnvelopeEditorSurface,
  openEmbeddedEnvelopeEditor,
} from '../fixtures/envelope-editor';

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
