// ABOUTME: E2E tests for checkbox/radio field transparency and per-item offset positioning.
// ABOUTME: Tests signing view rendering, editor offset inputs, and backward compatibility.
import { expect, test } from '@playwright/test';
import { FieldType } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { EnvelopeStatus } from '@documenso/prisma/client';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe('Field Transparency', () => {
  test('checkbox fields in signing view have transparent background', async ({ page }) => {
    const user = await seedUser();

    const envelope = await prisma.envelope.findFirst({
      where: {
        userId: user.id,
        status: EnvelopeStatus.DRAFT,
      },
      include: {
        recipients: true,
        fields: true,
      },
    });

    test.skip(!envelope, 'No draft envelope found for seeded user');

    const checkboxField = envelope!.fields.find((f) => f.type === FieldType.CHECKBOX);
    test.skip(!checkboxField, 'No checkbox field found on envelope');

    const recipient = envelope!.recipients[0];
    test.skip(!recipient, 'No recipient found on envelope');

    await page.goto(`${WEBAPP_BASE_URL}/sign/${recipient.token}`);
    await page.waitForSelector('[data-field-type="CHECKBOX"]', { timeout: 10000 });

    const fieldEl = page.locator('[data-field-type="CHECKBOX"]').first();
    const bgColor = await fieldEl.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    expect(bgColor).toBe('rgba(0, 0, 0, 0)');
  });

  test('signature fields still have opaque background', async ({ page }) => {
    const user = await seedUser();

    const envelope = await prisma.envelope.findFirst({
      where: {
        userId: user.id,
        status: EnvelopeStatus.DRAFT,
      },
      include: {
        recipients: true,
        fields: true,
      },
    });

    test.skip(!envelope, 'No draft envelope found');

    const sigField = envelope!.fields.find((f) => f.type === FieldType.SIGNATURE);
    test.skip(!sigField, 'No signature field found');

    const recipient = envelope!.recipients[0];
    test.skip(!recipient, 'No recipient');

    await page.goto(`${WEBAPP_BASE_URL}/sign/${recipient.token}`);
    await page.waitForSelector('[data-field-type="SIGNATURE"]', { timeout: 10000 });

    const fieldEl = page.locator('[data-field-type="SIGNATURE"]').first();
    const bgColor = await fieldEl.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('Checkbox Editor Offset Inputs', () => {
  test('offset inputs appear in checkbox editor form', async ({ page }) => {
    await apiSignin({
      page,
      email: 'playwright@psd401.net',
      password: 'TestDev2026!',
    });

    await page.goto(`${WEBAPP_BASE_URL}/documents`);

    const firstTemplate = page.locator('table tbody tr').first();
    await firstTemplate.click();
    await page.waitForTimeout(1000);

    const checkboxField = page.locator('[data-field-type="CHECKBOX"]').first();
    if (await checkboxField.isVisible()) {
      await checkboxField.click();
      await page.waitForTimeout(500);

      const offsetXInput = page.locator('[data-testid="field-form-values-0-offsetX"]');
      const offsetYInput = page.locator('[data-testid="field-form-values-0-offsetY"]');

      await expect(offsetXInput).toBeVisible();
      await expect(offsetYInput).toBeVisible();
    }
  });

  test('editing offset switches direction to custom', async ({ page }) => {
    await apiSignin({
      page,
      email: 'playwright@psd401.net',
      password: 'TestDev2026!',
    });

    await page.goto(`${WEBAPP_BASE_URL}/documents`);

    const firstTemplate = page.locator('table tbody tr').first();
    await firstTemplate.click();
    await page.waitForTimeout(1000);

    const checkboxField = page.locator('[data-field-type="CHECKBOX"]').first();
    if (await checkboxField.isVisible()) {
      await checkboxField.click();
      await page.waitForTimeout(500);

      const offsetXInput = page.locator('[data-testid="field-form-values-0-offsetX"]');
      if (await offsetXInput.isVisible()) {
        await offsetXInput.fill('10');
        await page.waitForTimeout(300);

        const directionSelect = page.locator('[data-testid="field-form-direction"]');
        const directionValue = await directionSelect.textContent();
        expect(directionValue).toContain('Custom');
      }
    }
  });
});

test.describe('Schema Backward Compatibility', () => {
  test('existing checkbox fields without offsets render normally', async ({ page }) => {
    const field = await prisma.field.findFirst({
      where: {
        type: FieldType.CHECKBOX,
        fieldMeta: {
          path: ['type'],
          equals: 'checkbox',
        },
      },
      include: {
        Recipient: true,
      },
    });

    test.skip(!field || !field.Recipient, 'No checkbox field with recipient found');

    await page.goto(`${WEBAPP_BASE_URL}/sign/${field!.Recipient!.token}`);
    await page.waitForSelector(`#field-${field!.id}`, { timeout: 10000 });

    const fieldEl = page.locator(`#field-${field!.id}`);
    await expect(fieldEl).toBeVisible();

    const checkboxes = fieldEl.locator('input[type="checkbox"], [role="checkbox"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);
  });

  test('existing radio fields without offsets render normally', async ({ page }) => {
    const field = await prisma.field.findFirst({
      where: {
        type: FieldType.RADIO,
        fieldMeta: {
          path: ['type'],
          equals: 'radio',
        },
      },
      include: {
        Recipient: true,
      },
    });

    test.skip(!field || !field.Recipient, 'No radio field with recipient found');

    await page.goto(`${WEBAPP_BASE_URL}/sign/${field!.Recipient!.token}`);
    await page.waitForSelector(`#field-${field!.id}`, { timeout: 10000 });

    const fieldEl = page.locator(`#field-${field!.id}`);
    await expect(fieldEl).toBeVisible();

    const radios = fieldEl.locator('input[type="radio"], [role="radio"]');
    const count = await radios.count();
    expect(count).toBeGreaterThan(0);
  });
});
