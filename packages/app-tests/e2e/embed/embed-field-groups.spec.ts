import { expect, type Page, test } from '@playwright/test';
import { FieldType } from '@prisma/client';

import { apiSeedPendingDocument } from '../fixtures/api-seeds';
import { clickSigningField, expectFieldsInDatabase, openSigningPage } from '../fixtures/envelope-signing';

type TEmbedFieldEvent = {
  action: 'field-signed' | 'field-unsigned';
  data: { fieldId?: number; value?: string; isBase64?: boolean };
};

const FIELD_SIZE = { width: 20, height: 5 };

/**
 * The embed page posts events to `window.parent`. When loaded directly the parent is the
 * page itself, so the events can be captured with a message listener.
 */
const captureEmbedFieldEvents = async (page: Page) => {
  await page.addInitScript(() => {
    const events: unknown[] = [];

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    (window as unknown as { __embedFieldEvents: unknown[] }).__embedFieldEvents = events;

    window.addEventListener('message', (event) => {
      if (event.data?.action === 'field-signed' || event.data?.action === 'field-unsigned') {
        events.push(event.data);
      }
    });
  });
};

const getEmbedFieldEvents = async (page: Page): Promise<TEmbedFieldEvent[]> => {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return (window as unknown as { __embedFieldEvents: TEmbedFieldEvent[] }).__embedFieldEvents ?? [];
  });
};

test('embed signing emits field events for every member of a group', async ({ page, request }) => {
  const groupId = 'grp_embed_text';

  const { envelope, distributeResult } = await apiSeedPendingDocument(request, {
    recipients: [{ email: 'embed-group-signer@test.documenso.com', name: 'Embed Group Signer' }],
    fieldsPerRecipient: [
      [
        { type: FieldType.SIGNATURE, page: 1, positionX: 60, positionY: 5, ...FIELD_SIZE },
        {
          type: FieldType.TEXT,
          page: 1,
          positionX: 5,
          positionY: 10,
          ...FIELD_SIZE,
          groupId,
          externalId: 'text-a',
          fieldMeta: { type: 'text', required: true },
        },
        {
          type: FieldType.TEXT,
          page: 1,
          positionX: 5,
          positionY: 25,
          ...FIELD_SIZE,
          groupId,
          externalId: 'text-b',
          fieldMeta: { type: 'text', required: true },
        },
      ],
    ],
  });

  const { token } = distributeResult.recipients[0];
  const textFields = envelope.fields.filter((field) => field.groupId === groupId);
  const [textA, textB] = textFields;

  await captureEmbedFieldEvents(page);

  const canvas = await openSigningPage(page, `/embed/sign/${token}`);

  // Signing one member emits a signed event for each member.
  await clickSigningField(canvas, textA);
  await page.getByRole('dialog').locator('textarea').fill('Acme Inc');
  await page.getByRole('button', { name: 'Enter' }).click();

  await expectFieldsInDatabase([
    { fieldId: textA.id, inserted: true, customText: 'Acme Inc' },
    { fieldId: textB.id, inserted: true, customText: 'Acme Inc' },
  ]);

  await expect(async () => {
    const events = await getEmbedFieldEvents(page);
    const signedEvents = events.filter((event) => event.action === 'field-signed');

    expect(signedEvents.map((event) => event.data.fieldId).sort()).toEqual([textA.id, textB.id].sort());
    expect(signedEvents.every((event) => event.data.value === JSON.stringify('Acme Inc'))).toBe(true);
  }).toPass();

  // Clearing one member emits an unsigned event for each member.
  await clickSigningField(canvas, textB);

  await expectFieldsInDatabase([
    { fieldId: textA.id, inserted: false },
    { fieldId: textB.id, inserted: false },
  ]);

  await expect(async () => {
    const events = await getEmbedFieldEvents(page);
    const unsignedEvents = events.filter((event) => event.action === 'field-unsigned');

    expect(unsignedEvents.map((event) => event.data.fieldId).sort()).toEqual([textA.id, textB.id].sort());
  }).toPass();
});
