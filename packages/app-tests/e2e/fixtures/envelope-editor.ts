import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { DEFAULT_EMBEDDED_EDITOR_CONFIG } from '@documenso/lib/types/envelope-editor';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from './authentication';

const examplePdfBuffer = fs.readFileSync(path.join(__dirname, '../../../../assets/example.pdf'));

export type TEnvelopeEditorSurface = {
  root: Page;
  isEmbedded: boolean;
  envelopeId?: string;
  envelopeType: TEnvelopeEditorType;
  userId: number;
  userEmail: string;
  userName: string;
  teamId: number;
};

export type TEnvelopeEditorType = 'DOCUMENT' | 'TEMPLATE';

type TEmbeddedHashCommonOptions = {
  externalId?: string;
  features?: typeof DEFAULT_EMBEDDED_EDITOR_CONFIG;
  css?: string;
  cssVars?: Record<string, string>;
  darkModeDisabled?: boolean;
};

const encodeEmbeddedOptions = (options: Record<string, unknown>) => {
  const encodedPayload = encodeURIComponent(JSON.stringify(options));

  if (typeof btoa === 'function') {
    return btoa(encodedPayload);
  }

  return Buffer.from(encodedPayload, 'utf8').toString('base64');
};

export const createEmbeddedEnvelopeCreateHash = ({
  envelopeType,
  externalId,
  features = DEFAULT_EMBEDDED_EDITOR_CONFIG,
  css,
  cssVars,
  darkModeDisabled,
}: { envelopeType: TEnvelopeEditorType } & TEmbeddedHashCommonOptions) => {
  return encodeEmbeddedOptions({
    externalId,
    type: envelopeType,
    features,
    css,
    cssVars,
    darkModeDisabled,
  });
};

export const createEmbeddedEnvelopeEditHash = ({
  externalId,
  features = DEFAULT_EMBEDDED_EDITOR_CONFIG,
  css,
  cssVars,
  darkModeDisabled,
}: TEmbeddedHashCommonOptions) => {
  return encodeEmbeddedOptions({
    externalId,
    features,
    css,
    cssVars,
    darkModeDisabled,
  });
};

export const openDocumentEnvelopeEditor = async (page: Page): Promise<TEnvelopeEditorSurface> => {
  const { user, team } = await seedUser();

  const document = await seedBlankDocument(user, team.id, {
    internalVersion: 2,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit?step=uploadAndRecipients`,
  });

  return {
    root: page,
    isEmbedded: false,
    envelopeId: document.id,
    envelopeType: 'DOCUMENT',
    userId: user.id,
    userEmail: user.email,
    userName: user.name ?? '',
    teamId: team.id,
  };
};

export const openTemplateEnvelopeEditor = async (page: Page): Promise<TEnvelopeEditorSurface> => {
  const { user, team } = await seedUser();

  const template = await seedBlankTemplate(user, team.id, {
    createTemplateOptions: {
      title: `E2E Template ${Date.now()}`,
      userId: user.id,
      teamId: team.id,
      internalVersion: 2,
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/templates/${template.id}/edit?step=uploadAndRecipients`,
  });

  return {
    root: page,
    isEmbedded: false,
    envelopeId: template.id,
    envelopeType: 'TEMPLATE',
    userId: user.id,
    userEmail: user.email,
    userName: user.name ?? '',
    teamId: team.id,
  };
};

type OpenEmbeddedEnvelopeEditorOptions = {
  envelopeType: TEnvelopeEditorType;
  mode?: 'create' | 'edit';
  tokenNamePrefix?: string;
  externalId?: string;
  features?: typeof DEFAULT_EMBEDDED_EDITOR_CONFIG;
  css?: string;
  cssVars?: Record<string, string>;
  darkModeDisabled?: boolean;
};

export const openEmbeddedEnvelopeEditor = async (
  page: Page,
  {
    envelopeType,
    mode = 'create',
    tokenNamePrefix = 'e2e-embed',
    externalId,
    features,
    css,
    cssVars,
    darkModeDisabled,
  }: OpenEmbeddedEnvelopeEditorOptions,
): Promise<TEnvelopeEditorSurface> => {
  const { user, team } = await seedUser();

  const envelopeToEdit =
    mode === 'edit'
      ? envelopeType === 'DOCUMENT'
        ? await seedBlankDocument(user, team.id, {
            internalVersion: 2,
          })
        : await seedBlankTemplate(user, team.id, {
            createTemplateOptions: {
              title: `E2E Template ${Date.now()}`,
              userId: user.id,
              teamId: team.id,
              internalVersion: 2,
            },
          })
      : null;

  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: `${tokenNamePrefix}-${envelopeType.toLowerCase()}`,
    expiresIn: null,
  });

  const embeddedToken = await resolveEmbeddingToken(
    page,
    token,
    envelopeToEdit ? `envelopeId:${envelopeToEdit.id}` : undefined,
  );

  if (envelopeToEdit) {
    const hash = createEmbeddedEnvelopeEditHash({
      externalId,
      features: features ?? DEFAULT_EMBEDDED_EDITOR_CONFIG,
      css,
      cssVars,
      darkModeDisabled,
    });

    await page.goto(
      `/embed/v2/authoring/envelope/edit/${envelopeToEdit.id}?token=${encodeURIComponent(embeddedToken)}#${hash}`,
    );
  } else {
    const hash = createEmbeddedEnvelopeCreateHash({
      envelopeType,
      externalId,
      features,
      css,
      cssVars,
      darkModeDisabled,
    });

    await page.goto(
      `/embed/v2/authoring/envelope/create?token=${encodeURIComponent(embeddedToken)}#${hash}`,
    );
  }

  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

  return {
    root: page,
    isEmbedded: true,
    envelopeId: envelopeToEdit?.id,
    envelopeType,
    userId: user.id,
    userEmail: user.email,
    userName: user.name ?? '',
    teamId: team.id,
  };
};

export const getEnvelopeEditorSettingsTrigger = (root: Page) =>
  root.locator('button[title="Settings"]');

export const getEnvelopeItemTitleInputs = (root: Page) =>
  root.locator('[data-testid^="envelope-item-title-input-"]');

export const getEnvelopeItemDragHandles = (root: Page) =>
  root.locator('[data-testid^="envelope-item-drag-handle-"]');

export const getEnvelopeItemRemoveButtons = (root: Page) =>
  root.locator('[data-testid^="envelope-item-remove-button-"]');

export const getEnvelopeItemDropzoneInput = (root: Page) =>
  root.locator('[data-testid="envelope-item-dropzone"] input[type="file"]');

export const addEnvelopeItemPdf = async (root: Page, fileName = 'embedded-envelope-item.pdf') => {
  await getEnvelopeItemDropzoneInput(root).setInputFiles({
    name: fileName,
    mimeType: 'application/pdf',
    buffer: examplePdfBuffer,
  });
};

export const getRecipientEmailInputs = (root: Page) =>
  root.locator('[data-testid="signer-email-input"]');

export const getRecipientNameInputs = (root: Page) =>
  root.locator('input[placeholder^="Recipient "]');

export const getRecipientRows = (root: Page) =>
  root.locator('[data-testid="signer-email-input"]').locator('xpath=ancestor::fieldset[1]');

export const getRecipientRemoveButtons = (root: Page) =>
  root.locator('[data-testid="remove-signer-button"]');

export const getSigningOrderInputs = (root: Page) =>
  root.locator('[data-testid="signing-order-input"]');

export const clickEnvelopeEditorStep = async (
  root: Page,
  stepId: 'upload' | 'addFields' | 'preview',
) => {
  await root.waitForTimeout(200);
  await root.locator(`[data-testid="envelope-editor-step-${stepId}"]`).first().click();
};

export const clickAddMyselfButton = async (root: Page) => {
  await root.getByRole('button', { name: 'Add Myself' }).click();
};

export const clickAddSignerButton = async (root: Page) => {
  await root.getByRole('button', { name: 'Add Signer' }).click();
};

export const setRecipientEmail = async (root: Page, index: number, email: string) => {
  await getRecipientEmailInputs(root).nth(index).fill(email);
};

export const setRecipientName = async (root: Page, index: number, name: string) => {
  await getRecipientNameInputs(root).nth(index).fill(name);
};

export const setRecipientRole = async (
  root: Page,
  index: number,
  roleLabel:
    | 'Needs to sign'
    | 'Needs to approve'
    | 'Needs to view'
    | 'Receives copy'
    | 'Can prepare',
) => {
  const row = getRecipientRows(root).nth(index);

  await row.locator('button[role="combobox"]').first().click();
  await root.getByRole('option', { name: roleLabel }).click();
};

export const assertRecipientRole = async (
  root: Page,
  index: number,
  roleLabel:
    | 'Needs to sign'
    | 'Needs to approve'
    | 'Needs to view'
    | 'Receives copy'
    | 'Can prepare',
) => {
  const row = getRecipientRows(root).nth(index);
  const roleValueByLabel: Record<typeof roleLabel, string> = {
    'Needs to sign': 'SIGNER',
    'Needs to approve': 'APPROVER',
    'Needs to view': 'VIEWER',
    'Receives copy': 'CC',
    'Can prepare': 'ASSISTANT',
  };

  await expect(row.locator('button[role="combobox"]').first()).toHaveAttribute(
    'title',
    roleValueByLabel[roleLabel],
  );
};

export const toggleSigningOrder = async (root: Page, enabled: boolean) => {
  const checkbox = root.locator('#signingOrder');
  const currentState = await checkbox.getAttribute('aria-checked');
  const isEnabled = currentState === 'true';

  if (isEnabled !== enabled) {
    await checkbox.click();
  }
};

export const toggleAllowDictateSigners = async (root: Page, enabled: boolean) => {
  const checkbox = root.locator('#allowDictateNextSigner');
  const currentState = await checkbox.getAttribute('aria-checked');
  const isEnabled = currentState === 'true';

  if (isEnabled !== enabled) {
    await checkbox.click();
  }
};

export const setSigningOrderValue = async (root: Page, index: number, value: number) => {
  const input = getSigningOrderInputs(root).nth(index);
  await input.fill(value.toString());
  await input.blur();
};

export const persistEmbeddedEnvelope = async (surface: TEnvelopeEditorSurface) => {
  if (!surface.isEmbedded) {
    return;
  }

  const isUpdateFlow =
    (await surface.root.getByRole('button', { name: 'Update Document' }).count()) > 0 ||
    (await surface.root.getByRole('button', { name: 'Update Template' }).count()) > 0;

  const actionButtonName = isUpdateFlow
    ? surface.envelopeType === 'DOCUMENT'
      ? 'Update Document'
      : 'Update Template'
    : surface.envelopeType === 'DOCUMENT'
      ? 'Create Document'
      : 'Create Template';

  await surface.root.getByRole('button', { name: actionButtonName }).click();

  const completionHeading = isUpdateFlow
    ? surface.envelopeType === 'DOCUMENT'
      ? 'Document Updated'
      : 'Template Updated'
    : surface.envelopeType === 'DOCUMENT'
      ? 'Document Created'
      : 'Template Created';

  await expect(surface.root.getByRole('heading', { name: completionHeading })).toBeVisible();
};

const resolveEmbeddingToken = async (
  page: Page,
  inputToken: string,
  scope?: string,
): Promise<string> => {
  if (!inputToken.startsWith('api_')) {
    return inputToken;
  }

  const response = await page
    .context()
    .request.post(`${NEXT_PUBLIC_WEBAPP_URL()}/api/v2/embedding/create-presign-token`, {
      headers: {
        Authorization: `Bearer ${inputToken}`,
        'Content-Type': 'application/json',
      },
      data: scope ? { scope } : {},
    });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to exchange API token (${response.status()}): ${text}`);
  }

  const data: unknown = await response.json();

  if (typeof data !== 'object' || data === null || !('token' in data)) {
    throw new Error(`Unexpected response shape: ${JSON.stringify(data)}`);
  }

  const token = data.token;

  if (typeof token !== 'string' || token.length === 0) {
    throw new Error(`Unexpected response shape: ${JSON.stringify(data)}`);
  }

  return token;
};
