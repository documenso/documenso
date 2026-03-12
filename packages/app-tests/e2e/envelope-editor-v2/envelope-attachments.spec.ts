import { type Page, expect, test } from '@playwright/test';

import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

import {
  type TEnvelopeEditorSurface,
  addEnvelopeItemPdf,
  getEnvelopeEditorSettingsTrigger,
  openDocumentEnvelopeEditor,
  openEmbeddedEnvelopeEditor,
  openTemplateEnvelopeEditor,
  persistEmbeddedEnvelope,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';

const TEST_ATTACHMENTS = {
  first: {
    label: 'E2E First Attachment',
    url: 'https://example.com/first-attachment',
  },
  second: {
    label: 'E2E Second Attachment',
    url: 'https://example.com/second-attachment',
  },
  third: {
    label: 'E2E Third Attachment',
    url: 'https://example.com/third-attachment',
  },
};

type AttachmentFlowResult = {
  externalId: string;
  expectedAttachments: Array<{ label: string; url: string }>;
  deletedAttachment: { label: string; url: string };
};

const openSettingsDialog = async (root: Page) => {
  await getEnvelopeEditorSettingsTrigger(root).click();
  await expect(root.getByRole('heading', { name: 'Document Settings' })).toBeVisible();
};

const updateExternalId = async (surface: TEnvelopeEditorSurface, externalId: string) => {
  await openSettingsDialog(surface.root);
  await surface.root.locator('input[name="externalId"]').fill(externalId);
  await surface.root.getByRole('button', { name: 'Update' }).click();

  if (!surface.isEmbedded) {
    await expectToastTextToBeVisible(surface.root, 'Envelope updated');
  }
};

const openAttachmentsPopover = async (root: Page) => {
  await root.getByRole('button', { name: 'Attachments' }).click();

  await expect(root.getByRole('heading', { name: 'Attachments', level: 4 })).toBeVisible();
};

const addAttachment = async (root: Page, { label, url }: { label: string; url: string }) => {
  await root.getByRole('button', { name: 'Add Attachment' }).click();
  await root.getByPlaceholder('Label').fill(label);
  await root.getByPlaceholder('URL').fill(url);
  await root.getByRole('button', { name: 'Add', exact: true }).click();
};

const getAttachmentItems = (root: Page) => root.locator('.rounded-md.border.border-border.p-2');

const getAttachmentDeleteButtons = (root: Page) => getAttachmentItems(root).locator('button');

const assertAttachmentVisibleInPopover = async (
  root: Page,
  { label, url }: { label: string; url: string },
) => {
  const items = getAttachmentItems(root);
  const matchingItem = items.filter({ hasText: label });

  await expect(matchingItem).toBeVisible();
  await expect(matchingItem.locator(`a[href="${url}"]`)).toBeVisible();
};

const assertAttachmentNotVisibleInPopover = async (root: Page, label: string) => {
  await expect(getAttachmentItems(root).filter({ hasText: label })).toHaveCount(0);
};

const assertAttachmentCount = async (root: Page, count: number) => {
  const button = root.getByRole('button', { name: 'Attachments' });

  if (count > 0) {
    await expect(button).toContainText(`(${count})`);
  } else {
    await expect(button).not.toContainText('(');
  }
};

const assertAttachmentsInDatabase = async ({
  externalId,
  surface,
  expectedAttachments,
  deletedLabel,
}: {
  externalId: string;
  surface: TEnvelopeEditorSurface;
  expectedAttachments: Array<{ label: string; url: string }>;
  deletedLabel?: string;
}) => {
  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      externalId,
      userId: surface.userId,
      teamId: surface.teamId,
      type: surface.envelopeType,
    },
    include: {
      envelopeAttachments: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  expect(envelope.envelopeAttachments).toHaveLength(expectedAttachments.length);

  for (const expected of expectedAttachments) {
    const found = envelope.envelopeAttachments.find((a) => a.label === expected.label);

    expect(found).toBeDefined();
    expect(found!.data).toBe(expected.url);
    expect(found!.type).toBe('link');
  }

  if (deletedLabel) {
    expect(envelope.envelopeAttachments.some((a) => a.label === deletedLabel)).toBe(false);
  }
};

const runAttachmentFlow = async (
  surface: TEnvelopeEditorSurface,
): Promise<AttachmentFlowResult> => {
  const externalId = `e2e-attachments-${nanoid()}`;

  await updateExternalId(surface, externalId);
  await openAttachmentsPopover(surface.root);

  // Create first attachment.
  await addAttachment(surface.root, TEST_ATTACHMENTS.first);
  await expectToastTextToBeVisible(surface.root, 'Attachment added successfully.');
  await assertAttachmentVisibleInPopover(surface.root, TEST_ATTACHMENTS.first);
  await assertAttachmentCount(surface.root, 1);

  await assertAttachmentsInDatabase({
    externalId,
    surface,
    expectedAttachments: [TEST_ATTACHMENTS.first],
  });

  // Create second attachment.
  await addAttachment(surface.root, TEST_ATTACHMENTS.second);
  await expectToastTextToBeVisible(surface.root, 'Attachment added successfully.');
  await assertAttachmentVisibleInPopover(surface.root, TEST_ATTACHMENTS.second);
  await assertAttachmentCount(surface.root, 2);

  await assertAttachmentsInDatabase({
    externalId,
    surface,
    expectedAttachments: [TEST_ATTACHMENTS.first, TEST_ATTACHMENTS.second],
  });

  // Create third attachment.
  await addAttachment(surface.root, TEST_ATTACHMENTS.third);
  await expectToastTextToBeVisible(surface.root, 'Attachment added successfully.');
  await assertAttachmentVisibleInPopover(surface.root, TEST_ATTACHMENTS.third);
  await assertAttachmentCount(surface.root, 3);

  await assertAttachmentsInDatabase({
    externalId,
    surface,
    expectedAttachments: [TEST_ATTACHMENTS.first, TEST_ATTACHMENTS.second, TEST_ATTACHMENTS.third],
  });

  // Delete first attachment.
  await getAttachmentDeleteButtons(surface.root).first().click();
  await expectToastTextToBeVisible(surface.root, 'Attachment removed successfully.');

  await expect(getAttachmentItems(surface.root)).toHaveCount(2);
  await assertAttachmentNotVisibleInPopover(surface.root, TEST_ATTACHMENTS.first.label);
  await assertAttachmentVisibleInPopover(surface.root, TEST_ATTACHMENTS.second);
  await assertAttachmentVisibleInPopover(surface.root, TEST_ATTACHMENTS.third);
  await assertAttachmentCount(surface.root, 2);

  await assertAttachmentsInDatabase({
    externalId,
    surface,
    expectedAttachments: [TEST_ATTACHMENTS.second, TEST_ATTACHMENTS.third],
    deletedLabel: TEST_ATTACHMENTS.first.label,
  });

  return {
    externalId,
    expectedAttachments: [TEST_ATTACHMENTS.second, TEST_ATTACHMENTS.third],
    deletedAttachment: TEST_ATTACHMENTS.first,
  };
};

const runEmbeddedAttachmentFlow = async (
  surface: TEnvelopeEditorSurface,
): Promise<AttachmentFlowResult> => {
  const externalId = `e2e-attachments-${nanoid()}`;

  await updateExternalId(surface, externalId);
  await openAttachmentsPopover(surface.root);

  // Create first attachment.
  await addAttachment(surface.root, TEST_ATTACHMENTS.first);
  await expectToastTextToBeVisible(surface.root, 'Attachment added successfully.');
  await assertAttachmentVisibleInPopover(surface.root, TEST_ATTACHMENTS.first);
  await assertAttachmentCount(surface.root, 1);

  // Create second attachment.
  await addAttachment(surface.root, TEST_ATTACHMENTS.second);
  await expectToastTextToBeVisible(surface.root, 'Attachment added successfully.');
  await assertAttachmentVisibleInPopover(surface.root, TEST_ATTACHMENTS.second);
  await assertAttachmentCount(surface.root, 2);

  // Create third attachment.
  await addAttachment(surface.root, TEST_ATTACHMENTS.third);
  await expectToastTextToBeVisible(surface.root, 'Attachment added successfully.');
  await assertAttachmentVisibleInPopover(surface.root, TEST_ATTACHMENTS.third);
  await assertAttachmentCount(surface.root, 3);

  // Delete first attachment.
  await getAttachmentDeleteButtons(surface.root).first().click();
  await expectToastTextToBeVisible(surface.root, 'Attachment removed successfully.');

  await expect(getAttachmentItems(surface.root)).toHaveCount(2);
  await assertAttachmentNotVisibleInPopover(surface.root, TEST_ATTACHMENTS.first.label);
  await assertAttachmentVisibleInPopover(surface.root, TEST_ATTACHMENTS.second);
  await assertAttachmentVisibleInPopover(surface.root, TEST_ATTACHMENTS.third);
  await assertAttachmentCount(surface.root, 2);

  return {
    externalId,
    expectedAttachments: [TEST_ATTACHMENTS.second, TEST_ATTACHMENTS.third],
    deletedAttachment: TEST_ATTACHMENTS.first,
  };
};

const assertAttachmentsPersistedInDatabase = async ({
  surface,
  externalId,
  expectedAttachments,
  deletedAttachment,
}: {
  surface: TEnvelopeEditorSurface;
  externalId: string;
  expectedAttachments: AttachmentFlowResult['expectedAttachments'];
  deletedAttachment: AttachmentFlowResult['deletedAttachment'];
}) => {
  await assertAttachmentsInDatabase({
    externalId,
    surface,
    expectedAttachments,
    deletedLabel: deletedAttachment.label,
  });
};

test.describe('document editor', () => {
  test('add, verify and delete attachments', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const result = await runAttachmentFlow(surface);

    await assertAttachmentsPersistedInDatabase({
      surface,
      ...result,
    });
  });
});

test.describe('template editor', () => {
  test('add, verify and delete attachments', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const result = await runAttachmentFlow(surface);

    await assertAttachmentsPersistedInDatabase({
      surface,
      ...result,
    });
  });
});

test.describe('embedded create', () => {
  test('add, verify and delete attachments', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-embed-attachments',
    });

    await addEnvelopeItemPdf(surface.root, 'embedded-document-attachments.pdf');

    const result = await runEmbeddedAttachmentFlow(surface);
    await persistEmbeddedEnvelope(surface);

    await assertAttachmentsPersistedInDatabase({
      surface,
      ...result,
    });
  });
});

test.describe('embedded edit', () => {
  test('add, verify and delete attachments', async ({ page }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-attachments',
    });

    const result = await runEmbeddedAttachmentFlow(surface);
    await persistEmbeddedEnvelope(surface);

    await assertAttachmentsPersistedInDatabase({
      surface,
      ...result,
    });
  });
});
