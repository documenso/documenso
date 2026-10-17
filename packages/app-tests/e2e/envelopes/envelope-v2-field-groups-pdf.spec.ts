import {
  FIELD_GROUP_EXTERNAL_IDS,
  FIELD_GROUPS,
  FIELD_GROUPS_TEST_FIELDS,
  findFieldGroupTestField,
} from '@documenso/lib/constants/test-pdfs/field-groups-pdf';
import { prisma } from '@documenso/prisma';
import { expect, type Route, test } from '@playwright/test';
import { DocumentStatus } from '@prisma/client';
import { apiSeedFieldGroupsDocument } from '../fixtures/api-seeds';
import {
  clickSigningField,
  completeSigning,
  expectFieldsInDatabase,
  expectFieldsRemaining,
  getCompleteButton,
  getGroupBar,
  getNextFieldButton,
  hoverSigningField,
  openSigningPage,
  setupTypedSignature,
} from '../fixtures/envelope-signing';
import {
  clickKonvaFieldOption,
  getKonvaFieldGroupHighlight,
  getKonvaOptionTexts,
  hasKonvaFieldSpinner,
} from '../fixtures/konva';

const SIGNER = {
  email: 'field-groups-pdf-signer@test.documenso.com',
  name: 'Field Groups Signer',
  role: 'SIGNER' as const,
};

/**
 * Navigates the signing page to the given envelope page by scrolling it into view.
 */
const scrollToSigningPage = async (page: Parameters<typeof openSigningPage>[0], pageNumber: number) => {
  const pageImage = page.locator(`img[data-page-number="${pageNumber}"]`);

  await pageImage.scrollIntoViewIfNeeded();
  await expect(page.locator(`.konva-container canvas`).nth(pageNumber - 1)).toBeVisible({ timeout: 30_000 });
};

const getPageCanvas = (page: Parameters<typeof openSigningPage>[0], pageNumber: number) =>
  page.locator('.konva-container canvas').nth(pageNumber - 1);

test.describe('V2 field groups PDF', () => {
  test('every group type is created, auto inserted on send and signable as one field', async ({ page, request }) => {
    const { envelope, distributeResult } = await apiSeedFieldGroupsDocument(request, { recipient: SIGNER });

    const { token } = distributeResult.recipients[0];
    const { fields } = envelope;

    // Every test field was created with its group and external ID intact.
    expect(fields).toHaveLength(FIELD_GROUPS_TEST_FIELDS.length);

    for (const testField of FIELD_GROUPS_TEST_FIELDS) {
      const field = findFieldGroupTestField(fields, testField.externalId);

      expect(field.type).toBe(testField.type);
      expect(field.page).toBe(testField.page);
      expect(field.groupId).toBe(testField.groupId);
    }

    const signature = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.signature);
    const textA = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.textA);
    const textB = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.textB);
    const textC = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.textC);
    const textD = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.textD);
    const numberA = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.numberA);
    const numberB = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.numberB);
    const dropdownA = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.dropdownA);
    const dropdownB = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.dropdownB);
    const nameA = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.nameA);
    const nameB = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.nameB);
    const emailA = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.emailA);
    const emailB = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.emailB);
    const radioA = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.radioA);
    const radioB = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.radioB);
    const radioC = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.radioC);
    const atLeastA = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.checkboxAtLeastA);
    const atLeastB = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.checkboxAtLeastB);
    const exactlyA = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.checkboxExactlyA);
    const exactlyB = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.checkboxExactlyB);
    const atMostA = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.checkboxAtMostA);
    const atMostB = findFieldGroupTestField(fields, FIELD_GROUP_EXTERNAL_IDS.checkboxAtMostB);

    // Sending auto inserts the email group, the radio group (C is pre-checked) and the
    // optional "at most" checkbox group (A1 is pre-checked, which satisfies the rule).
    await expectFieldsInDatabase([
      { fieldId: emailA.id, inserted: true, customText: SIGNER.email },
      { fieldId: emailB.id, inserted: true, customText: SIGNER.email },
      { fieldId: radioA.id, inserted: true, customText: '' },
      { fieldId: radioB.id, inserted: true, customText: '' },
      { fieldId: radioC.id, inserted: true, customText: '0' },
      { fieldId: atMostA.id, inserted: true, customText: '[0]' },
      { fieldId: atMostB.id, inserted: true, customText: '' },
    ]);

    await openSigningPage(page, `/sign/${token}`);

    // Remaining: signature, text group, number group, dropdown group, name group,
    // "at least" checkbox group, "exactly" checkbox group. Email, radio and "at most"
    // were auto inserted. Each group counts once.
    await expectFieldsRemaining(page, 7);

    // Signature on page 1.
    await setupTypedSignature(page, SIGNER.name);
    await clickSigningField(getPageCanvas(page, 1), signature);
    await expectFieldsInDatabase([{ fieldId: signature.id, inserted: true }]);
    await expectFieldsRemaining(page, 6);

    // Hovering a grouped field shows a bar which can navigate through the group,
    // including across pages. Navigating pins the bar open.
    await scrollToSigningPage(page, 2);
    await hoverSigningField(getPageCanvas(page, 2), textA);

    await expect(getGroupBar(page, textA.id)).toContainText('Grouped field1 of 4');

    // The other members of the group are lightly highlighted while one is hovered.
    await expect.poll(async () => await getKonvaFieldGroupHighlight(page, 2, textB.id)).toBeCloseTo(0.06);
    expect(await getKonvaFieldGroupHighlight(page, 2, textA.id)).toBeNull();

    await page.getByTestId('field-group-bar-next').click();
    await expect(getGroupBar(page, textB.id)).toContainText('2 of 4');

    // The pinned bar survives the pointer leaving, and the pinned field is highlighted
    // like a hovered one with the rest of the group lighter.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(800);
    await expect(getGroupBar(page, textB.id)).toBeVisible();
    await expect.poll(async () => await getKonvaFieldGroupHighlight(page, 2, textB.id)).toBeCloseTo(0.3);
    await expect.poll(async () => await getKonvaFieldGroupHighlight(page, 2, textA.id)).toBeCloseTo(0.06);

    // Hovering another grouped field moves the bar there and drops the pin, so it hides
    // once the pointer leaves.
    await hoverSigningField(getPageCanvas(page, 2), textC);
    await expect(getGroupBar(page, textC.id)).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(page.getByTestId('field-group-bar')).toHaveCount(0);

    // Clicking anywhere outside the bar releases the pin.
    await hoverSigningField(getPageCanvas(page, 2), textA);
    await page.getByTestId('field-group-bar-next').click();
    await expect(getGroupBar(page, textB.id)).toBeVisible();
    await page.mouse.click(0, 0);
    await expect(page.getByTestId('field-group-bar')).toHaveCount(0);

    // Wrapping backwards lands on the last member, on page 7.
    await hoverSigningField(getPageCanvas(page, 2), textA);
    await expect(getGroupBar(page, textA.id)).toContainText('1 of 4');
    await page.getByTestId('field-group-bar-previous').click();
    await expect(getGroupBar(page, textD.id)).toContainText('4 of 4');
    await expect(page.locator('img[data-page-number="7"]')).toBeInViewport();

    // Text group spans pages 2 and 7. Filling A on page 2 fills D on page 7. The sign
    // request is held so the spinner can be observed on every member of the group.
    await scrollToSigningPage(page, 2);

    let releaseSignRequest = () => {};

    const signRequestHold = new Promise<void>((resolve) => {
      releaseSignRequest = resolve;
    });

    // Only the first sign request is held, later ones pass straight through.
    let isSignRequestHeld = false;

    await page.route('**/api/trpc/envelope.field.sign**', async (route: Route) => {
      if (!isSignRequestHeld) {
        isSignRequestHeld = true;
        await signRequestHold;
      }

      await route.continue();
    });

    await clickSigningField(getPageCanvas(page, 2), textA);
    await page.getByRole('dialog').locator('textarea').fill('Acme Inc');
    await page.getByRole('button', { name: 'Enter' }).click();

    await expect
      .poll(async () => {
        return await Promise.all([
          hasKonvaFieldSpinner(page, 2, textA.id),
          hasKonvaFieldSpinner(page, 2, textB.id),
          hasKonvaFieldSpinner(page, 7, textD.id),
        ]);
      })
      .toEqual([true, true, true]);

    releaseSignRequest();

    await expect.poll(async () => await hasKonvaFieldSpinner(page, 7, textD.id)).toBe(false);

    // Once the group is inserted the pinned bar is released, so it hides when not hovered
    // and the group highlight clears.
    await page.mouse.move(0, 0);
    await expect(page.getByTestId('field-group-bar')).toHaveCount(0);
    await expect.poll(async () => await getKonvaFieldGroupHighlight(page, 2, textB.id)).toBeNull();

    await expectFieldsInDatabase([
      { fieldId: textA.id, inserted: true, customText: 'Acme Inc' },
      { fieldId: textB.id, inserted: true, customText: 'Acme Inc' },
      { fieldId: textC.id, inserted: true, customText: 'Acme Inc' },
      { fieldId: textD.id, inserted: true, customText: 'Acme Inc' },
    ]);
    await expectFieldsRemaining(page, 5);

    // Number group on page 3.
    await scrollToSigningPage(page, 3);
    await clickSigningField(getPageCanvas(page, 3), numberA);
    await page.getByRole('dialog').locator('input').first().fill('42');
    await page.getByRole('button', { name: 'Enter' }).click();

    await expectFieldsInDatabase([
      { fieldId: numberA.id, inserted: true, customText: '42' },
      { fieldId: numberB.id, inserted: true, customText: '42' },
    ]);
    await expectFieldsRemaining(page, 4);

    // Dropdown and name groups on page 4.
    await scrollToSigningPage(page, 4);
    await clickSigningField(getPageCanvas(page, 4), dropdownA);
    await page.getByRole('option', { name: 'Blue' }).click();

    await expectFieldsInDatabase([
      { fieldId: dropdownA.id, inserted: true, customText: 'Blue' },
      { fieldId: dropdownB.id, inserted: true, customText: 'Blue' },
    ]);
    await expectFieldsRemaining(page, 3);

    // The recipient already has a name so name fields insert without a dialog.
    await clickSigningField(getPageCanvas(page, 4), nameB);

    await expectFieldsInDatabase([
      { fieldId: nameA.id, inserted: true, customText: SIGNER.name },
      { fieldId: nameB.id, inserted: true, customText: SIGNER.name },
    ]);
    await expectFieldsRemaining(page, 2);

    // Radio group on page 5 was auto inserted with C selected. Selecting on A moves it.
    await scrollToSigningPage(page, 5);
    await clickKonvaFieldOption(page, 5, radioA.id, { type: 'radio', index: 1 });

    await expectFieldsInDatabase([
      { fieldId: radioA.id, inserted: true, customText: '1' },
      { fieldId: radioB.id, inserted: true, customText: '' },
      { fieldId: radioC.id, inserted: true, customText: '' },
    ]);
    await expectFieldsRemaining(page, 2);

    // Checkbox groups on page 6.
    await scrollToSigningPage(page, 6);

    // "At least 2": one tick is accepted but blocks completion until the pool has two.
    await clickKonvaFieldOption(page, 6, atLeastA.id, { type: 'checkbox', index: 0 });
    await expectFieldsInDatabase([
      { fieldId: atLeastA.id, inserted: true, customText: '[0]' },
      { fieldId: atLeastB.id, inserted: true, customText: '' },
    ]);
    await expectFieldsRemaining(page, 2);
    await expect(getCompleteButton(page)).toHaveCount(0);

    await clickKonvaFieldOption(page, 6, atLeastB.id, { type: 'checkbox', index: 1 });
    await expectFieldsInDatabase([{ fieldId: atLeastB.id, inserted: true, customText: '[1]' }]);
    await expectFieldsRemaining(page, 1);

    // "Exactly 1": ticking on both members breaks the rule, the tooltip explains why.
    await clickKonvaFieldOption(page, 6, exactlyA.id, { type: 'checkbox', index: 0 });
    await expectFieldsInDatabase([{ fieldId: exactlyA.id, inserted: true, customText: '[0]' }]);
    await expectFieldsRemaining(page, 0);

    await clickKonvaFieldOption(page, 6, exactlyB.id, { type: 'checkbox', index: 0 });
    await expectFieldsInDatabase([{ fieldId: exactlyB.id, inserted: true, customText: '[0]' }]);
    await expectFieldsRemaining(page, 1);

    await getNextFieldButton(page).click();
    await expect(page.getByText('Select exactly 1 option')).toBeVisible();

    await clickKonvaFieldOption(page, 6, exactlyB.id, { type: 'checkbox', index: 0 });
    await expectFieldsInDatabase([{ fieldId: exactlyB.id, inserted: true, customText: '' }]);
    await expectFieldsRemaining(page, 0);

    // Member B hides its option labels, so its option text renders empty.
    expect(await getKonvaOptionTexts(page, 6, atMostA.id, 'checkbox')).toEqual(['A1', 'A2']);
    expect(await getKonvaOptionTexts(page, 6, atMostB.id, 'checkbox')).toEqual(['', '']);

    // "At most 2" (optional): auto inserted with one tick, adding two more breaks it.
    await clickKonvaFieldOption(page, 6, atMostB.id, { type: 'checkbox', index: 0 });
    await expectFieldsInDatabase([{ fieldId: atMostB.id, inserted: true, customText: '[0]' }]);
    await expectFieldsRemaining(page, 0);

    await clickKonvaFieldOption(page, 6, atMostB.id, { type: 'checkbox', index: 1 });
    await expectFieldsInDatabase([{ fieldId: atMostB.id, inserted: true, customText: '[0,1]' }]);
    await expectFieldsRemaining(page, 1);

    await getNextFieldButton(page).click();
    await expect(page.getByText('Select at most 2 options')).toBeVisible();

    // While the group is invalid, navigating keeps the bar pinned on the target member.
    await page.getByTestId('field-group-bar-next').click();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(800);
    await expect(getGroupBar(page, atMostB.id)).toContainText('2 of 2');

    await clickKonvaFieldOption(page, 6, atMostB.id, { type: 'checkbox', index: 1 });
    await expectFieldsInDatabase([{ fieldId: atMostB.id, inserted: true, customText: '[0]' }]);
    await expectFieldsRemaining(page, 0);

    await completeSigning(page);

    await page.waitForURL(`/sign/${token}/complete`);
    await expect(page.getByText('Document Signed')).toBeVisible();

    await expect(async () => {
      const dbEnvelope = await prisma.envelope.findUniqueOrThrow({ where: { id: envelope.id } });

      expect(dbEnvelope.status).toBe(DocumentStatus.COMPLETED);
    }).toPass();

    // Every member of every group ends up inserted.
    const groupedFields = await prisma.field.findMany({
      where: { envelopeId: envelope.id, groupId: { in: Object.values(FIELD_GROUPS) } },
    });

    expect(groupedFields.every((field) => field.inserted)).toBe(true);
  });
});
