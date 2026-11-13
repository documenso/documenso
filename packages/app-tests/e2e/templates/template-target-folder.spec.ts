import { AppErrorCode } from '@documenso/lib/errors/app-error';
import { updateEnvelope } from '@documenso/lib/server-only/envelope/update-envelope';
import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { formatDirectTemplatePath } from '@documenso/lib/utils/templates';
import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedBlankFolder } from '@documenso/prisma/seed/folders';
import { seedDirectTemplate } from '@documenso/prisma/seed/templates';
import { seedTestEmail, seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { FolderType } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';
import { getEnvelopeEditorSettingsTrigger } from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';
import { signSignaturePad } from '../fixtures/signature';

const requestMetadata: ApiRequestMetadata = {
  requestMetadata: {},
  source: 'app',
  auth: null,
};

test('[TEMPLATE_TARGET_FOLDER]: target folder configured in settings applies to direct links and template use with override', async ({
  page,
}) => {
  const { user, team } = await seedUser();

  const targetFolder = await seedBlankFolder(user, team.id, {
    createFolderOptions: {
      name: 'Target Folder',
      type: FolderType.DOCUMENT,
    },
  });

  const overrideFolder = await seedBlankFolder(user, team.id, {
    createFolderOptions: {
      name: 'Override Folder',
      type: FolderType.DOCUMENT,
    },
  });

  const template = await seedDirectTemplate({
    title: 'Direct template with target folder',
    userId: user.id,
    teamId: team.id,
    internalVersion: 2,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
  });

  await getEnvelopeEditorSettingsTrigger(page).click();
  await expect(page.getByRole('heading', { name: 'Document Settings' })).toBeVisible();

  const targetFolderSelect = page.getByTestId('templateTargetFolderSelectValue');
  await expect(targetFolderSelect).toContainText('Home (No Folder)');

  await targetFolderSelect.click();
  await page.getByRole('option', { name: 'Target Folder' }).click();
  await page.getByRole('button', { name: 'Update' }).click();

  await expectToastTextToBeVisible(page, 'Envelope updated');

  await getEnvelopeEditorSettingsTrigger(page).click();
  await expect(page.getByTestId('templateTargetFolderSelectValue')).toContainText('Target Folder');
  await page.keyboard.press('Escape');

  const directSignatureField = template.fields[0];

  if (!directSignatureField || !template.directLink) {
    throw new Error('Expected seeded direct template field and direct link to exist');
  }

  await page.goto(formatDirectTemplatePath(template.directLink.token));
  await expect(page.locator('img[data-page-number]').first()).toBeVisible({ timeout: 30_000 });

  const canvas = page.locator('.konva-container canvas').first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  await signSignaturePad(page);

  const canvasBox = await canvas.boundingBox();

  if (!canvasBox) {
    throw new Error('Canvas bounding box not found');
  }

  const x =
    (Number(directSignatureField.positionX) / 100) * canvasBox.width +
    ((Number(directSignatureField.width) / 100) * canvasBox.width) / 2;
  const y =
    (Number(directSignatureField.positionY) / 100) * canvasBox.height +
    ((Number(directSignatureField.height) / 100) * canvasBox.height) / 2;

  await canvas.click({ position: { x, y } });
  await expect(page.getByText('0 Fields Remaining').first()).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByPlaceholder('Enter Your Name').fill('Direct Signer');
  await page.getByPlaceholder('Enter Your Email').fill(seedTestEmail());
  await page.getByRole('button', { name: 'Sign' }).click();

  await page.waitForURL(/\/sign/);
  await expect(page.getByRole('heading', { name: 'Document Signed' })).toBeVisible();

  const directCreatedEnvelope = await prisma.envelope.findFirstOrThrow({
    where: {
      templateId: mapSecondaryIdToTemplateId(template.secondaryId),
    },
    orderBy: { createdAt: 'desc' },
  });

  expect(directCreatedEnvelope.folderId).toBe(targetFolder.id);

  await page.goto(`/t/${team.url}/templates`);
  await page.getByRole('button', { name: 'Use Template' }).click();
  await expect(page.getByRole('heading', { name: 'Create document from template' })).toBeVisible();

  const useTargetFolderSelect = page.getByTestId('templateUseTargetFolderSelectValue');
  await expect(useTargetFolderSelect).toContainText('Target Folder');

  await useTargetFolderSelect.click();
  await page.getByRole('option', { name: 'Override Folder' }).click();
  await page.getByRole('button', { name: 'Create as draft' }).click();

  await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

  const overriddenEnvelopeId = page.url().split('/').pop()?.split('?')[0];
  const overriddenEnvelope = await prisma.envelope.findFirstOrThrow({
    where: { id: overriddenEnvelopeId },
  });

  expect(overriddenEnvelope.folderId).toBe(overrideFolder.id);

  await page.goto(`/t/${team.url}/templates`);
  await page.getByRole('button', { name: 'Use Template' }).click();
  await expect(useTargetFolderSelect).toContainText('Target Folder');

  await useTargetFolderSelect.click();
  await page.getByRole('option', { name: 'Home (No Folder)' }).click();
  await page.getByRole('button', { name: 'Create as draft' }).click();

  await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

  const rootOverrideEnvelopeId = page.url().split('/').pop()?.split('?')[0];
  const rootOverrideEnvelope = await prisma.envelope.findFirstOrThrow({
    where: { id: rootOverrideEnvelopeId },
  });

  expect(rootOverrideEnvelope.folderId).toBeNull();
});

test('[TEMPLATE_TARGET_FOLDER]: deleting the target folder falls back to the root folder', async ({ page }) => {
  const { user, team } = await seedUser();

  const targetFolder = await seedBlankFolder(user, team.id, {
    createFolderOptions: {
      name: 'Ephemeral Folder',
      type: FolderType.DOCUMENT,
    },
  });

  await seedDirectTemplate({
    title: 'Template with deleted target folder',
    userId: user.id,
    teamId: team.id,
    internalVersion: 2,
    createTemplateOptions: {
      targetFolderId: targetFolder.id,
    },
  });

  await prisma.folder.delete({
    where: { id: targetFolder.id },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  await page.getByRole('button', { name: 'Use Template' }).click();
  await expect(page.getByTestId('templateUseTargetFolderSelectValue')).toContainText('Home (No Folder)');
  await page.getByRole('button', { name: 'Create as draft' }).click();

  await page.waitForURL(new RegExp(`/t/${team.url}/documents/envelope_.*`));

  const createdEnvelopeId = page.url().split('/').pop()?.split('?')[0];
  const createdEnvelope = await prisma.envelope.findFirstOrThrow({
    where: { id: createdEnvelopeId },
  });

  expect(createdEnvelope.folderId).toBeNull();
});

test('[TEMPLATE_TARGET_FOLDER]: rejects non-document folders, cross-team folders and document envelopes', async () => {
  const { user, team } = await seedUser();
  const { user: otherUser, team: otherTeam } = await seedUser();

  const template = await seedDirectTemplate({
    title: 'Validation template',
    userId: user.id,
    teamId: team.id,
    internalVersion: 2,
  });

  const documentEnvelope = await seedBlankDocument(user, team.id);

  const templateTypeFolder = await seedBlankFolder(user, team.id, {
    createFolderOptions: {
      name: 'Template Folder',
      type: FolderType.TEMPLATE,
    },
  });

  const otherTeamDocumentFolder = await seedBlankFolder(otherUser, otherTeam.id, {
    createFolderOptions: {
      name: 'Other Team Folder',
      type: FolderType.DOCUMENT,
    },
  });

  await expect(
    updateEnvelope({
      userId: user.id,
      teamId: team.id,
      id: { type: 'envelopeId', id: documentEnvelope.id },
      data: { targetFolderId: otherTeamDocumentFolder.id },
      requestMetadata,
    }),
  ).rejects.toMatchObject({
    code: AppErrorCode.INVALID_BODY,
  });

  await expect(
    updateEnvelope({
      userId: user.id,
      teamId: team.id,
      id: { type: 'envelopeId', id: template.id },
      data: { targetFolderId: templateTypeFolder.id },
      requestMetadata,
    }),
  ).rejects.toMatchObject({
    code: AppErrorCode.NOT_FOUND,
  });

  await expect(
    updateEnvelope({
      userId: user.id,
      teamId: team.id,
      id: { type: 'envelopeId', id: template.id },
      data: { targetFolderId: otherTeamDocumentFolder.id },
      requestMetadata,
    }),
  ).rejects.toMatchObject({
    code: AppErrorCode.NOT_FOUND,
  });

  const validFolder = await seedBlankFolder(user, team.id, {
    createFolderOptions: {
      name: 'Valid Target Folder',
      type: FolderType.DOCUMENT,
    },
  });

  await updateEnvelope({
    userId: user.id,
    teamId: team.id,
    id: { type: 'envelopeId', id: template.id },
    data: { targetFolderId: validFolder.id },
    requestMetadata,
  });

  const defaultFolderDoc = await createDocumentFromTemplate({
    id: { type: 'envelopeId', id: template.id },
    userId: user.id,
    teamId: team.id,
    recipients: template.recipients.map((r) => ({
      id: r.id,
      name: 'Recipient',
      email: seedTestEmail(),
    })),
    requestMetadata,
  });

  expect(defaultFolderDoc.folderId).toBe(validFolder.id);

  const rootOverrideDoc = await createDocumentFromTemplate({
    id: { type: 'envelopeId', id: template.id },
    userId: user.id,
    teamId: team.id,
    folderId: null,
    recipients: template.recipients.map((r) => ({
      id: r.id,
      name: 'Recipient',
      email: seedTestEmail(),
    })),
    requestMetadata,
  });

  expect(rootOverrideDoc.folderId).toBeNull();
});
