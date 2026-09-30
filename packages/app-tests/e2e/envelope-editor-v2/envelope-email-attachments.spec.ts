import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { expect, test } from '@playwright/test';

import {
  addEnvelopeItemPdf,
  getEnvelopeEditorSettingsTrigger,
  openDocumentEnvelopeEditor,
  openEmbeddedEnvelopeEditor,
  openTemplateEnvelopeEditor,
  persistEmbeddedEnvelope,
  setRecipientEmail,
  type TEnvelopeEditorSurface,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';

const runAttachmentSettingsFlow = async (surface: TEnvelopeEditorSurface) => {
  const { root, isEmbedded } = surface;
  const externalId = `e2e-email-attachments-${nanoid()}`;

  if (isEmbedded && !surface.envelopeId) {
    await addEnvelopeItemPdf(root);
    await setRecipientEmail(root, 0, 'signer@example.com');
  }

  for (const attachDocument of [false, true, false]) {
    await getEnvelopeEditorSettingsTrigger(root).click();
    await root.locator('input[name="externalId"]').fill(externalId);
    await root.getByRole('button', { name: 'Notifications' }).click();
    const attachmentControl = root.getByRole('checkbox', { name: 'Attach completed document PDFs to emails' });
    await expect(attachmentControl).toBeChecked({ checked: !attachDocument });
    await attachmentControl.setChecked(attachDocument);
    await expect(root.locator('#documentCompleted')).toBeChecked();
    await expect(root.locator('#ownerDocumentCompleted')).toBeChecked();
    await root.getByRole('button', { name: 'Update', exact: true }).click();

    if (!isEmbedded) {
      await expectToastTextToBeVisible(root, 'Envelope updated');
      const meta = await prisma.envelope.findUniqueOrThrow({
        where: { id: surface.envelopeId },
        include: { documentMeta: true },
      });
      expect(meta.documentMeta.emailSettings).toMatchObject({ attachDocument });
      await root.reload();
    }
  }

  if (isEmbedded) {
    await persistEmbeddedEnvelope(surface);
  }

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: { externalId, userId: surface.userId, teamId: surface.teamId, type: surface.envelopeType },
    include: { documentMeta: true },
  });
  expect(envelope.documentMeta.emailSettings).toMatchObject({
    attachDocument: false,
    documentCompleted: true,
    ownerDocumentCompleted: true,
  });
};

test.describe('document editor', () => {
  test('save email attachment opt-out and toggle back', async ({ page }) => {
    await runAttachmentSettingsFlow(await openDocumentEnvelopeEditor(page));
  });
});

test.describe('template editor', () => {
  test('save email attachment opt-out and toggle back', async ({ page }) => {
    await runAttachmentSettingsFlow(await openTemplateEnvelopeEditor(page));
  });
});

test.describe('embedded create', () => {
  test('save email attachment opt-out and toggle back', async ({ page }) => {
    await runAttachmentSettingsFlow(await openEmbeddedEnvelopeEditor(page, { envelopeType: 'DOCUMENT' }));
  });
});

test.describe('embedded edit', () => {
  test('save email attachment opt-out and toggle back', async ({ page }) => {
    await runAttachmentSettingsFlow(await openEmbeddedEnvelopeEditor(page, { envelopeType: 'TEMPLATE', mode: 'edit' }));
  });
});
