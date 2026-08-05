import fs from 'node:fs';
import path from 'node:path';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { DEFAULT_EMBEDDED_EDITOR_CONFIG } from '@documenso/lib/types/envelope-editor';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

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
  folderId,
  features = DEFAULT_EMBEDDED_EDITOR_CONFIG,
  css,
  cssVars,
  darkModeDisabled,
}: { envelopeType: TEnvelopeEditorType; folderId?: string } & TEmbeddedHashCommonOptions) => {
  return encodeEmbeddedOptions({
    externalId,
    type: envelopeType,
    folderId,
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
  folderId?: string;
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
    folderId,
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
      folderId,
      features,
      css,
      cssVars,
      darkModeDisabled,
    });

    await page.goto(`/embed/v2/authoring/envelope/create?token=${encodeURIComponent(embeddedToken)}#${hash}`);
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

export const getEnvelopeEditorSettingsTrigger = (root: Page) => root.locator('button[title="Settings"]');

export const getEnvelopeItemTitleInputs = (root: Page) => root.locator('[data-testid^="envelope-item-title-input-"]');

export const getEnvelopeItemDragHandles = (root: Page) => root.locator('[data-testid^="envelope-item-drag-handle-"]');

export const getEnvelopeItemRemoveButtons = (root: Page) =>
  root.locator('[data-testid^="envelope-item-remove-button-"]');

export const getEnvelopeItemReplaceButtons = (root: Page) =>
  root.locator('[data-testid^="envelope-item-replace-button-"]');

export const getEnvelopeItemDropzoneInput = (root: Page) =>
  root.locator('[data-testid="envelope-item-dropzone"] input[type="file"]');

export const addEnvelopeItemPdf = async (root: Page, fileName = 'embedded-envelope-item.pdf') => {
  await getEnvelopeItemDropzoneInput(root).setInputFiles({
    name: fileName,
    mimeType: 'application/pdf',
    buffer: examplePdfBuffer,
  });
};

export const getRecipientEmailInputs = (root: Page) => root.locator('[data-testid="signer-email-input"]');

export const getRecipientNameInputs = (root: Page) => root.locator('input[placeholder^="Recipient "]');

export const getRecipientRows = (root: Page) =>
  root.locator('[data-testid="signer-email-input"]').locator('xpath=ancestor::fieldset[1]');

export const getRecipientRemoveButtons = (root: Page) => root.locator('[data-testid="remove-signer-button"]');

export const clickEnvelopeEditorStep = async (root: Page, stepId: 'upload' | 'addFields' | 'preview') => {
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
  roleLabel: 'Needs to sign' | 'Needs to approve' | 'Needs to view' | 'Receives copy' | 'Can prepare',
) => {
  const row = getRecipientRows(root).nth(index);

  await row.locator('button[role="combobox"]').first().click();
  await root.getByRole('option', { name: roleLabel }).click();
};

export const assertRecipientRole = async (
  root: Page,
  index: number,
  roleLabel: 'Needs to sign' | 'Needs to approve' | 'Needs to view' | 'Receives copy' | 'Can prepare',
) => {
  const row = getRecipientRows(root).nth(index);
  const roleValueByLabel: Record<typeof roleLabel, string> = {
    'Needs to sign': 'SIGNER',
    'Needs to approve': 'APPROVER',
    'Needs to view': 'VIEWER',
    'Receives copy': 'CC',
    'Can prepare': 'ASSISTANT',
  };

  await expect(row.locator('button[role="combobox"]').first()).toHaveAttribute('title', roleValueByLabel[roleLabel]);
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

/**
 * Performs a mouse-based drag from a drag handle onto a target element.
 *
 * `@hello-pangea/dnd` only starts a drag once the pointer travels a small
 * distance while pressed, and it hit-tests drop targets using the CENTRE of
 * the dragged element — not the cursor. Since drag handles sit at the edge of
 * wide rows/cards, the cursor destination is compensated so the dragged
 * element's centre lands on the target's centre.
 */
export const dragHandleToTarget = async (
  root: Page,
  handle: Locator,
  target: Locator,
  options: { activeClass: string },
) => {
  const { activeClass } = options;

  await handle.scrollIntoViewIfNeeded();

  const handleBox = await handle.boundingBox();

  if (!handleBox) {
    throw new Error('Unable to resolve drag handle position');
  }

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  await root.mouse.move(startX, startY);
  await root.mouse.down();

  // Exceed the drag activation threshold, then wait for drag-dependent layout
  // (e.g. expanding gap drop-zones) to settle before resolving positions.
  const cursorX = startX + 8;
  const cursorY = startY;

  await root.mouse.move(cursorX, cursorY, { steps: 2 });
  await root.waitForTimeout(300);

  // The dragged element is the handle's draggable ancestor; while dragging it
  // is fixed-positioned and follows the cursor at a constant offset. Drop
  // targeting uses the dragged element's CENTRE, not the cursor, so the
  // cursor destination is compensated by that offset.
  const draggedElement = handle.locator('xpath=ancestor-or-self::*[@data-rfd-draggable-id][1]');
  const draggedBox = await draggedElement.boundingBox();
  const targetBox = await target.boundingBox();

  if (!draggedBox || !targetBox) {
    await root.mouse.up();

    throw new Error('Unable to resolve drag positions');
  }

  const itemOffsetX = draggedBox.x + draggedBox.width / 2 - cursorX;
  const itemOffsetY = draggedBox.y + draggedBox.height / 2 - cursorY;

  const hasBecomeActive = async () => {
    const className = await target.getAttribute('class');

    return Boolean(className?.includes(activeClass));
  };

  // The highlight class is rendered from the library's own drag state, so it
  // cannot disagree with where a drop will land — both phases below only drop
  // once the target reports the drag as over it AND that state survives a
  // short confirmation dwell (it can flicker while crossing a card's
  // reorder/combine boundary).
  //
  // The cursor is always clamped inside the viewport: moving outside the
  // window cancels the drag (pointercancel), and holding near the bottom edge
  // lets the library auto-scroll the target up to the cursor instead.
  const viewportHeight = root.viewportSize()?.height ?? 720;
  const maxCursorY = viewportHeight - 40;

  const confirmAndDrop = async () => {
    if (!(await hasBecomeActive())) {
      return false;
    }

    await root.waitForTimeout(150);

    if (!(await hasBecomeActive())) {
      return false;
    }

    await root.mouse.up();

    return true;
  };

  let hasDropped = false;

  // Crawl-and-drop: approach from above and inch downward through the
  // corridor. Captured drop-target geometry can drift a few pixels from the
  // live layout for small targets, so a slow traversal is the reliable way to
  // hit them.
  const crawlX = targetBox.x + targetBox.width / 2 - itemOffsetX;
  const crawlStartY = Math.min(targetBox.y + targetBox.height / 2 - itemOffsetY - 140, maxCursorY);

  await root.mouse.move(crawlX, crawlStartY, { steps: 15 });
  await root.waitForTimeout(150);

  for (let step = 1; step <= 80; step += 1) {
    if (await confirmAndDrop()) {
      hasDropped = true;

      break;
    }

    await root.mouse.move(crawlX, Math.min(crawlStartY + step * 6, maxCursorY), { steps: 2 });
    await root.waitForTimeout(70);
  }

  if (!hasDropped) {
    await root.mouse.up();
  }

  await root.waitForTimeout(400);
};

export const getRecipientStepCards = (root: Page) => root.locator('[data-testid="recipient-step-card"]');

export const getRecipientStepGaps = (root: Page) => root.locator('[data-testid="recipient-step-gap"]');

export const getStepDragHandles = (root: Page) => root.locator('[data-testid="step-drag-handle"]');

export const getRecipientRowDragHandles = (root: Page) => root.locator('[data-testid="recipient-row-drag-handle"]');

/**
 * Drags a whole group card onto another card, merging the two groups.
 *
 * Uses @hello-pangea/dnd's keyboard drag mode: mouse-emulated combines are
 * unreliable because approaching a card traverses its reorder edge, which
 * displaces the target away from the cursor. Keyboard drags step through
 * positions (including combine states) deterministically.
 */
export const dragGroupCardOntoCard = async (root: Page, sourceCardIndex: number, targetCardIndex: number) => {
  const handle = getStepDragHandles(root).nth(sourceCardIndex);
  const target = getRecipientStepCards(root).nth(targetCardIndex);

  await handle.scrollIntoViewIfNeeded();
  await handle.focus();

  // Lift.
  await root.keyboard.press('Space');
  await root.waitForTimeout(250);

  const direction = targetCardIndex < sourceCardIndex ? 'ArrowUp' : 'ArrowDown';

  for (let press = 0; press < 4; press += 1) {
    await root.keyboard.press(direction);
    await root.waitForTimeout(250);

    const targetClassName = await target.getAttribute('class');

    if (targetClassName?.includes('ring-primary')) {
      // Drop while the target reports the combine state.
      await root.keyboard.press('Space');
      await root.waitForTimeout(400);

      return;
    }
  }

  await root.keyboard.press('Escape');

  throw new Error('Combine drag did not reach the target card');
};

/**
 * Moves a group card one position up via keyboard drag. With combining
 * enabled, the first ArrowUp enters the combine state with the card above and
 * the second moves above it.
 */
export const moveGroupCardUp = async (root: Page, cardIndex: number) => {
  const handle = getStepDragHandles(root).nth(cardIndex);

  await handle.scrollIntoViewIfNeeded();
  await handle.focus();

  await root.keyboard.press('Space');
  await root.waitForTimeout(250);
  await root.keyboard.press('ArrowUp');
  await root.waitForTimeout(250);
  await root.keyboard.press('ArrowUp');
  await root.waitForTimeout(250);
  await root.keyboard.press('Space');
  await root.waitForTimeout(400);
};

/**
 * Drags a recipient row into a gap between group cards, extracting it into
 * its own standalone group at that position.
 */
export const dragRecipientRowToGap = async (root: Page, rowIndex: number, gapIndex: number) => {
  await dragHandleToTarget(
    root,
    getRecipientRowDragHandles(root).nth(rowIndex),
    getRecipientStepGaps(root).nth(gapIndex),
    // The marker class applied to a gap drop-zone while dragged over.
    { activeClass: 'gap-active' },
  );
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

const resolveEmbeddingToken = async (page: Page, inputToken: string, scope?: string): Promise<string> => {
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
