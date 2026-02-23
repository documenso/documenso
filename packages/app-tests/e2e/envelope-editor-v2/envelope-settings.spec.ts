import { type Page, expect, test } from '@playwright/test';
import { DocumentDistributionMethod, DocumentVisibility } from '@prisma/client';

import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

import {
  type TEnvelopeEditorSurface,
  getEnvelopeEditorSettingsTrigger,
  openDocumentEnvelopeEditor,
  openEmbeddedEnvelopeEditor,
  openTemplateEnvelopeEditor,
  persistEmbeddedEnvelope,
} from '../fixtures/envelope-editor';
import { expectToastTextToBeVisible } from '../fixtures/generic';

type SettingsFlowData = {
  externalId: string;
  isEmbedded: boolean;
};

const TEST_SETTINGS_VALUES = {
  replyTo: 'e2e-settings@example.com',
  redirectUrl: 'https://example.com/e2e-settings-complete',
  subject: 'E2E settings subject',
  message: 'E2E settings message',
  language: 'French',
  dateFormat: 'DD/MM/YYYY',
  timezone: 'Europe/London',
  distributionMethod: 'None',
  accessAuth: 'Require account',
  actionAuth: 'Require password',
  visibility: 'Managers and above',
};

const DB_EXPECTED_VALUES = {
  language: 'fr',
  dateFormat: 'dd/MM/yyyy',
  timezone: 'Europe/London',
  distributionMethod: DocumentDistributionMethod.NONE,
  visibility: DocumentVisibility.MANAGER_AND_ABOVE,
  globalAccessAuth: ['ACCOUNT'],
  globalActionAuth: ['PASSWORD'],
  emailSettings: {
    recipientSigned: false,
    recipientSigningRequest: false,
    recipientRemoved: false,
    documentPending: false,
    documentCompleted: false,
    documentDeleted: false,
    ownerDocumentCompleted: false,
  },
};

const openSettingsDialog = async (root: Page) => {
  await getEnvelopeEditorSettingsTrigger(root).click();
  await expect(root.getByRole('heading', { name: 'Document Settings' })).toBeVisible();
};

const clickSettingsDialogHeader = async (root: Page) => {
  await root.locator('[data-testid="envelope-editor-settings-dialog-header"]').click();
};

const getComboboxByLabel = (root: Page, label: string) =>
  root
    .locator(`label:has-text("${label}")`)
    .locator('xpath=..')
    .locator('[role="combobox"]')
    .first();

const selectMultiSelectOption = async (
  root: Page,
  dataTestId: 'documentAccessSelectValue' | 'documentActionSelectValue',
  optionLabel: string,
) => {
  const select = root.locator(`[data-testid="${dataTestId}"]`);

  await select.click();
  await root.locator('[cmdk-item]').filter({ hasText: optionLabel }).first().click();
  await clickSettingsDialogHeader(root);
};

const runSettingsFlow = async (
  { root }: TEnvelopeEditorSurface,
  { externalId, isEmbedded }: SettingsFlowData,
) => {
  await openSettingsDialog(root);

  await getComboboxByLabel(root, 'Language').click();
  await root.getByRole('option', { name: TEST_SETTINGS_VALUES.language }).click();
  await clickSettingsDialogHeader(root);

  const signatureTypesCombobox = getComboboxByLabel(root, 'Allowed Signature Types');

  await signatureTypesCombobox.click();
  await root.getByRole('option', { name: 'Upload' }).click();
  await clickSettingsDialogHeader(root);

  await getComboboxByLabel(root, 'Date Format').click();
  await root.getByRole('option', { name: TEST_SETTINGS_VALUES.dateFormat, exact: true }).click();
  await clickSettingsDialogHeader(root);

  await getComboboxByLabel(root, 'Time Zone').click();
  await root.locator('[cmdk-input]').last().fill(TEST_SETTINGS_VALUES.timezone);
  await root.getByRole('option', { name: TEST_SETTINGS_VALUES.timezone }).click();
  await clickSettingsDialogHeader(root);

  await root.locator('input[name="externalId"]').fill(externalId);
  await root.locator('input[name="meta.redirectUrl"]').fill(TEST_SETTINGS_VALUES.redirectUrl);

  await root.locator('[data-testid="documentDistributionMethodSelectValue"]').click();
  await root.getByRole('option', { name: TEST_SETTINGS_VALUES.distributionMethod }).click();
  await clickSettingsDialogHeader(root);

  await root.getByRole('button', { name: 'Email' }).click();
  await root.locator('#recipientSigned').click();
  await root.locator('#recipientSigningRequest').click();
  await root.locator('#recipientRemoved').click();
  await root.locator('#documentPending').click();
  await root.locator('#documentCompleted').click();
  await root.locator('#documentDeleted').click();
  await root.locator('#ownerDocumentCompleted').click();
  await root.locator('input[name="meta.emailReplyTo"]').fill(TEST_SETTINGS_VALUES.replyTo);
  await root.locator('input[name="meta.subject"]').fill(TEST_SETTINGS_VALUES.subject);
  await root.locator('textarea[name="meta.message"]').fill(TEST_SETTINGS_VALUES.message);

  await root.getByRole('button', { name: 'Security' }).click();
  await selectMultiSelectOption(root, 'documentAccessSelectValue', TEST_SETTINGS_VALUES.accessAuth);

  const actionAuthSelect = root.locator('[data-testid="documentActionSelectValue"]');
  const hasActionAuthSelect = (await actionAuthSelect.count()) > 0;

  if (hasActionAuthSelect) {
    await selectMultiSelectOption(
      root,
      'documentActionSelectValue',
      TEST_SETTINGS_VALUES.actionAuth,
    );
  }

  await root.locator('[data-testid="documentVisibilitySelectValue"]').click();
  await root.getByRole('option', { name: TEST_SETTINGS_VALUES.visibility }).click();
  await clickSettingsDialogHeader(root);

  await root.getByRole('button', { name: 'Update' }).click();

  if (!isEmbedded) {
    await expectToastTextToBeVisible(root, 'Envelope updated');
  }

  await openSettingsDialog(root);

  await expect(root.locator('input[name="externalId"]')).toHaveValue(externalId);
  await expect(root.locator('input[name="meta.redirectUrl"]')).toHaveValue(
    TEST_SETTINGS_VALUES.redirectUrl,
  );
  await expect(getComboboxByLabel(root, 'Language')).toContainText(TEST_SETTINGS_VALUES.language);
  await expect(getComboboxByLabel(root, 'Allowed Signature Types')).not.toContainText('Upload');
  await expect(getComboboxByLabel(root, 'Date Format')).toContainText(
    TEST_SETTINGS_VALUES.dateFormat,
  );
  await expect(getComboboxByLabel(root, 'Time Zone')).toContainText(TEST_SETTINGS_VALUES.timezone);
  await expect(root.locator('[data-testid="documentDistributionMethodSelectValue"]')).toContainText(
    TEST_SETTINGS_VALUES.distributionMethod,
  );

  await root.getByRole('button', { name: 'Email' }).click();
  await expect(root.locator('#recipientSigned')).toHaveAttribute('aria-checked', 'false');
  await expect(root.locator('#recipientSigningRequest')).toHaveAttribute('aria-checked', 'false');
  await expect(root.locator('#recipientRemoved')).toHaveAttribute('aria-checked', 'false');
  await expect(root.locator('#documentPending')).toHaveAttribute('aria-checked', 'false');
  await expect(root.locator('#documentCompleted')).toHaveAttribute('aria-checked', 'false');
  await expect(root.locator('#documentDeleted')).toHaveAttribute('aria-checked', 'false');
  await expect(root.locator('#ownerDocumentCompleted')).toHaveAttribute('aria-checked', 'false');
  await expect(root.locator('input[name="meta.emailReplyTo"]')).toHaveValue(
    TEST_SETTINGS_VALUES.replyTo,
  );
  await expect(root.locator('input[name="meta.subject"]')).toHaveValue(
    TEST_SETTINGS_VALUES.subject,
  );
  await expect(root.locator('textarea[name="meta.message"]')).toHaveValue(
    TEST_SETTINGS_VALUES.message,
  );

  await root.getByRole('button', { name: 'Security' }).click();
  await expect(root.locator('[data-testid="documentAccessSelectValue"]')).toContainText(
    TEST_SETTINGS_VALUES.accessAuth,
  );

  if (hasActionAuthSelect) {
    await expect(root.locator('[data-testid="documentActionSelectValue"]')).toContainText(
      TEST_SETTINGS_VALUES.actionAuth,
    );
  }

  await expect(root.locator('[data-testid="documentVisibilitySelectValue"]')).toContainText(
    TEST_SETTINGS_VALUES.visibility,
  );

  await root.getByRole('button', { name: 'Update' }).click();

  if (!isEmbedded) {
    await expectToastTextToBeVisible(root, 'Envelope updated');
  }

  return {
    hasActionAuthSelect,
  };
};

const assertEnvelopeSettingsPersistedInDatabase = async ({
  externalId,
  surface,
  hasActionAuthSelect,
}: {
  externalId: string;
  surface: TEnvelopeEditorSurface;
  hasActionAuthSelect: boolean;
}) => {
  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      externalId,
      userId: surface.userId,
      teamId: surface.teamId,
      type: surface.envelopeType,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      documentMeta: true,
    },
  });

  expect(envelope.externalId).toBe(externalId);
  expect(envelope.visibility).toBe(DB_EXPECTED_VALUES.visibility);
  expect(envelope.documentMeta.language).toBe(DB_EXPECTED_VALUES.language);
  expect(envelope.documentMeta.dateFormat).toBe(DB_EXPECTED_VALUES.dateFormat);
  expect(envelope.documentMeta.timezone).toBe(DB_EXPECTED_VALUES.timezone);
  expect(envelope.documentMeta.distributionMethod).toBe(DB_EXPECTED_VALUES.distributionMethod);
  expect(envelope.documentMeta.redirectUrl).toBe(TEST_SETTINGS_VALUES.redirectUrl);
  expect(envelope.documentMeta.emailReplyTo).toBe(TEST_SETTINGS_VALUES.replyTo);
  expect(envelope.documentMeta.subject).toBe(TEST_SETTINGS_VALUES.subject);
  expect(envelope.documentMeta.message).toBe(TEST_SETTINGS_VALUES.message);
  expect(envelope.documentMeta.drawSignatureEnabled).toBe(true);
  expect(envelope.documentMeta.typedSignatureEnabled).toBe(true);
  expect(envelope.documentMeta.uploadSignatureEnabled).toBe(false);
  expect(envelope.documentMeta.emailSettings).toMatchObject(DB_EXPECTED_VALUES.emailSettings);

  const authOptions = parseAuthOptions(envelope.authOptions);

  expect(authOptions.globalAccessAuth ?? []).toEqual(DB_EXPECTED_VALUES.globalAccessAuth);

  if (hasActionAuthSelect) {
    expect(authOptions.globalActionAuth ?? []).toEqual(DB_EXPECTED_VALUES.globalActionAuth);
  }
};

const parseAuthOptions = (
  authOptions: unknown,
): { globalAccessAuth: string[]; globalActionAuth: string[] } => {
  if (!isRecord(authOptions)) {
    return {
      globalAccessAuth: [],
      globalActionAuth: [],
    };
  }

  return {
    globalAccessAuth: Array.isArray(authOptions.globalAccessAuth)
      ? authOptions.globalAccessAuth.filter((entry): entry is string => typeof entry === 'string')
      : [],
    globalActionAuth: Array.isArray(authOptions.globalActionAuth)
      ? authOptions.globalActionAuth.filter((entry): entry is string => typeof entry === 'string')
      : [],
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

test.describe('Envelope Editor V2 - Envelope settings dialog', () => {
  test('documents/<id>: update and persist settings', async ({ page }) => {
    const surface = await openDocumentEnvelopeEditor(page);
    const externalId = `e2e-settings-${nanoid()}`;

    const { hasActionAuthSelect } = await runSettingsFlow(surface, {
      externalId,
      isEmbedded: false,
    });

    await assertEnvelopeSettingsPersistedInDatabase({
      externalId,
      surface,
      hasActionAuthSelect,
    });
  });

  test('templates/<id>: update and persist settings', async ({ page }) => {
    const surface = await openTemplateEnvelopeEditor(page);
    const externalId = `e2e-settings-${nanoid()}`;

    const { hasActionAuthSelect } = await runSettingsFlow(surface, {
      externalId,
      isEmbedded: false,
    });

    await assertEnvelopeSettingsPersistedInDatabase({
      externalId,
      surface,
      hasActionAuthSelect,
    });
  });

  test('/embed/v2/authoring/envelope/create DOCUMENT: update and persist settings', async ({
    page,
  }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'DOCUMENT',
      tokenNamePrefix: 'e2e-embed-settings',
    });
    const externalId = `e2e-settings-${nanoid()}`;

    const { hasActionAuthSelect } = await runSettingsFlow(surface, {
      externalId,
      isEmbedded: true,
    });

    await persistEmbeddedEnvelope(surface);

    await assertEnvelopeSettingsPersistedInDatabase({
      externalId,
      surface,
      hasActionAuthSelect,
    });
  });

  test('/embed/v2/authoring/envelope/edit/<id> TEMPLATE: update and persist settings', async ({
    page,
  }) => {
    const surface = await openEmbeddedEnvelopeEditor(page, {
      envelopeType: 'TEMPLATE',
      mode: 'edit',
      tokenNamePrefix: 'e2e-embed-settings',
    });
    const externalId = `e2e-settings-${nanoid()}`;

    const { hasActionAuthSelect } = await runSettingsFlow(surface, {
      externalId,
      isEmbedded: true,
    });

    await persistEmbeddedEnvelope(surface);

    await assertEnvelopeSettingsPersistedInDatabase({
      externalId,
      surface,
      hasActionAuthSelect,
    });
  });
});
