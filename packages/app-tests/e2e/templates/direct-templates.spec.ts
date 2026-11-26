import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import {
  FIELD_SIGNATURE_META_DEFAULT_VALUES,
  type ZCheckboxFieldMeta,
  type ZDropdownFieldMeta,
  ZFieldMetaNotOptionalSchema,
  type ZNumberFieldMeta,
  type ZRadioFieldMeta,
  type ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import { createDocumentAuthOptions } from '@documenso/lib/utils/document-auth';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { formatDirectTemplatePath } from '@documenso/lib/utils/templates';
import { prisma } from '@documenso/prisma';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { seedDirectTemplate, seedTemplate } from '@documenso/prisma/seed/templates';
import { seedTestEmail, seedUser } from '@documenso/prisma/seed/users';
import { type APIRequestContext, type APIResponse, expect, test } from '@playwright/test';
import { DocumentSigningOrder, FieldType, RecipientRole } from '@prisma/client';
import { customAlphabet } from 'nanoid';
import type { z } from 'zod';

import { apiSignin, WEBAPP_ORIGIN_HEADERS } from '../fixtures/authentication';
import { signSignaturePad } from '../fixtures/signature';

// Duped from `packages/lib/utils/teams.ts` due to errors when importing that file.
const formatDocumentsPath = (teamUrl: string) => `/t/${teamUrl}/documents`;
const formatTemplatesPath = (teamUrl: string) => `/t/${teamUrl}/templates`;

const nanoid = customAlphabet('1234567890abcdef', 10);

const expectSigningRequestJobForRecipient = async (recipientId: number) => {
  const job = await prisma.backgroundJob.findFirst({
    where: {
      jobId: 'send.signing.requested.email',
      payload: {
        path: ['recipientId'],
        equals: recipientId,
      },
    },
  });

  expect(job).not.toBeNull();
};

const seedSignatureFieldForRecipient = async (options: {
  envelopeId: string;
  recipientId: number;
  positionY: number;
}) => {
  const envelopeItem = await prisma.envelopeItem.findFirstOrThrow({
    where: { envelopeId: options.envelopeId },
  });

  return await prisma.field.create({
    data: {
      envelopeId: options.envelopeId,
      envelopeItemId: envelopeItem.id,
      recipientId: options.recipientId,
      type: FieldType.SIGNATURE,
      page: 1,
      positionX: 5,
      positionY: options.positionY,
      width: 20,
      height: 5,
      customText: '',
      inserted: false,
      fieldMeta: FIELD_SIGNATURE_META_DEFAULT_VALUES,
    },
  });
};

type AdvancedFieldMeta = z.input<
  | typeof ZCheckboxFieldMeta
  | typeof ZDropdownFieldMeta
  | typeof ZNumberFieldMeta
  | typeof ZRadioFieldMeta
  | typeof ZTextFieldMeta
>;

/**
 * The settings of each field to seed, keyed by the external ID the tests refer to it by.
 */
type FieldMetaByExternalId = Record<string, AdvancedFieldMeta>;

const FIELD_TYPE_BY_META_TYPE: Record<AdvancedFieldMeta['type'], FieldType> = {
  checkbox: FieldType.CHECKBOX,
  dropdown: FieldType.DROPDOWN,
  number: FieldType.NUMBER,
  radio: FieldType.RADIO,
  text: FieldType.TEXT,
};

const seedAdvancedFieldsForRecipient = async (options: {
  envelopeId: string;
  recipientId: number;
  fieldMetaByExternalId: FieldMetaByExternalId;
}) => {
  const envelopeItem = await prisma.envelopeItem.findFirstOrThrow({
    where: {
      envelopeId: options.envelopeId,
    },
  });

  await prisma.field.createMany({
    data: Object.entries(options.fieldMetaByExternalId).map(([externalId, fieldMeta], index) => ({
      envelopeId: options.envelopeId,
      envelopeItemId: envelopeItem.id,
      recipientId: options.recipientId,
      type: FIELD_TYPE_BY_META_TYPE[fieldMeta.type],
      page: 1,
      positionX: 40,
      positionY: 5 + index * 12,
      width: 20,
      height: 10,
      customText: '',
      inserted: false,
      externalId,
      fieldMeta: ZFieldMetaNotOptionalSchema.parse(fieldMeta),
    })),
  });
};

/**
 * The values a recipient or a whole document holds, by external ID, leaving out the signature
 * and any field which was not inserted.
 */
const findInsertedValues = async (where: { envelopeId: string } | { recipientId: number }) => {
  const fields = await prisma.field.findMany({
    where: {
      ...where,
      inserted: true,
      type: {
        not: FieldType.SIGNATURE,
      },
    },
  });

  return Object.fromEntries(fields.map((field) => [field.externalId, field.customText]));
};

type DirectLinkSignature = {
  value: string;
  isBase64: boolean;
};

const TYPED_SIGNATURE: DirectLinkSignature = { value: 'Direct Signer', isBase64: false };

const DRAWN_SIGNATURE: DirectLinkSignature = {
  value:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  isBase64: true,
};

const seedDirectTemplateWithAdvancedFields = async (options: {
  internalVersion: 1 | 2;
  fieldMetaByExternalId: FieldMetaByExternalId;
  typedSignatureEnabled?: boolean;
}) => {
  const { user, team } = await seedUser();

  const template = await seedDirectTemplate({
    userId: user.id,
    teamId: team.id,
    internalVersion: options.internalVersion,
  });

  await seedAdvancedFieldsForRecipient({
    envelopeId: template.id,
    recipientId: template.recipients[0].id,
    fieldMetaByExternalId: options.fieldMetaByExternalId,
  });

  await prisma.documentMeta.update({
    where: {
      id: template.documentMetaId,
    },
    data: {
      typedSignatureEnabled: options.typedSignatureEnabled,
    },
  });

  return template;
};

/**
 * Submits the direct link without the signing page, which is how a value the page would never
 * send reaches the server. Every value goes in one request, as the text its field would store.
 */
const submitDirectLink = async (
  request: APIRequestContext,
  templateId: string,
  valuesByExternalId: Record<string, string>,
  signature: DirectLinkSignature = TYPED_SIGNATURE,
) => {
  const template = await prisma.envelope.findUniqueOrThrow({
    where: {
      id: templateId,
    },
    include: {
      fields: true,
      directLink: true,
    },
  });

  const signedFieldValues = template.fields.flatMap((field) => {
    if (field.type === FieldType.SIGNATURE) {
      return [{ token: '', fieldId: field.id, ...signature }];
    }

    const value = valuesByExternalId[field.externalId ?? ''];

    return value === undefined ? [] : [{ token: '', fieldId: field.id, value, isBase64: false }];
  });

  return await request.post(`${NEXT_PUBLIC_WEBAPP_URL()}/api/trpc/template.createDocumentFromDirectTemplate`, {
    headers: { ...WEBAPP_ORIGIN_HEADERS, 'content-type': 'application/json' },
    data: JSON.stringify({
      json: {
        directTemplateToken: template.directLink?.token,
        directRecipientEmail: seedTestEmail(),
        directRecipientName: 'Direct Signer',
        templateUpdatedAt: template.updatedAt.toISOString(),
        signedFieldValues,
      },
      meta: { values: { templateUpdatedAt: ['Date'] } },
    }),
  });
};

const findCreatedDocumentValues = async (response: APIResponse) => {
  const body = await response.json();

  return await findInsertedValues({ envelopeId: body.result.data.json.envelopeId });
};

test('[DIRECT_TEMPLATES]: create direct link for template', async ({ page }) => {
  const { team, owner, organisation } = await seedTeam({
    createTeamMembers: 1,
  });

  // Should be visible to team members.
  const teamTemplate = await seedTemplate({
    title: 'Team template 1',
    userId: owner.id,
    teamId: team.id,
  });

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${team.url}/templates`,
  });

  const url = `${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/templates/${teamTemplate.id}`;

  // Owner should see list of templates with no direct link badge.
  await page.goto(url);
  await expect(page.getByRole('button', { name: 'direct link' })).toHaveCount(1);

  // Create direct link.
  await page.getByRole('button', { name: 'Create Direct Link' }).click();
  await page.getByRole('button', { name: 'Enable direct link signing' }).click();
  await page.getByRole('button', { name: 'Create one automatically' }).click();
  await expect(page.getByRole('heading', { name: 'Direct Link Signing' })).toBeVisible();

  await page.waitForTimeout(1000);
  await page.getByTestId('btn-dialog-close').click();

  // Expect badge to appear.
  await expect(page.getByRole('button', { name: 'direct link' })).toHaveCount(2);
});

test('[DIRECT_TEMPLATES]: toggle direct template link', async ({ page }) => {
  const { team, owner, organisation } = await seedTeam({
    createTeamMembers: 1,
  });

  // Should be visible to team members.
  const template = await seedDirectTemplate({
    title: 'Team direct template link 1',
    userId: owner.id,
    teamId: team.id,
  });

  await apiSignin({
    page,
    email: owner.email,
  });

  // Check that the direct template link is accessible.
  await page.goto(formatDirectTemplatePath(template.directLink?.token || ''));
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

  // Navigate to template settings and disable access.
  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}${formatTemplatesPath(template.team?.url)}`);
  await page.getByRole('cell', { name: 'Use Template' }).getByRole('button').nth(1).click();
  await page.getByTestId('template-direct-link').click();
  await page.getByRole('switch').click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Direct link signing has been').first()).toBeVisible();

  // Check that the direct template link is no longer accessible.
  await page.goto(formatDirectTemplatePath(template.directLink?.token || '123'));
  await expect(page.getByText('404 not found')).toBeVisible();
});

test('[DIRECT_TEMPLATES]: delete direct template link', async ({ page }) => {
  const { team, owner, organisation } = await seedTeam({
    createTeamMembers: 1,
  });

  // Should be visible to team members.
  const template = await seedDirectTemplate({
    title: 'Team direct template link 1',
    userId: owner.id,
    teamId: team.id,
  });

  await apiSignin({
    page,
    email: owner.email,
  });

  // Check that the direct template link is accessible.
  await page.goto(formatDirectTemplatePath(template.directLink?.token || ''));
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

  // Navigate to template settings and delete the access.
  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}${formatTemplatesPath(template.team?.url)}`);
  await page.getByRole('cell', { name: 'Use Template' }).getByRole('button').nth(1).click();
  await page.getByTestId('template-direct-link').click();
  await page.getByRole('button', { name: 'Remove' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Direct template link deleted').first()).toBeVisible();

  // Check that the direct template link is no longer accessible.
  await page.goto(formatDirectTemplatePath(template.directLink?.token || ''));
  await expect(page.getByText('404 not found')).toBeVisible();
});

test('[DIRECT_TEMPLATES]: V1 direct template link auth access', async ({ page }) => {
  const { user, team } = await seedUser();

  const directTemplateWithAuth = await seedDirectTemplate({
    title: 'Personal direct template link',
    userId: user.id,
    teamId: team.id,
    createTemplateOptions: {
      authOptions: createDocumentAuthOptions({
        globalAccessAuth: ['ACCOUNT'],
        globalActionAuth: [],
      }),
    },
  });

  const directTemplatePath = formatDirectTemplatePath(directTemplateWithAuth.directLink?.token || '');

  await page.goto(directTemplatePath);

  await expect(page.getByText('Authentication required')).toBeVisible();

  await apiSignin({
    page,
    email: user.email,
  });

  await page.goto(directTemplatePath);

  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeDisabled();

  const directSignatureField = directTemplateWithAuth.fields[0];

  if (!directSignatureField) {
    throw new Error('Expected seeded direct template signature field to exist');
  }

  await page.getByRole('button', { name: 'Continue' }).click();

  await signSignaturePad(page);
  await page.locator(`#field-${directSignatureField.id}`).getByRole('button').click();
  await expect(page.locator(`#field-${directSignatureField.id}`)).toHaveAttribute('data-inserted', 'true');

  await page.getByRole('button', { name: 'Complete' }).click();

  await page.getByRole('button', { name: 'Sign' }).click();
  await page.waitForURL(/\/sign/);
  await expect(page.getByRole('heading', { name: 'Document Signed' })).toBeVisible();
});

test('[DIRECT_TEMPLATES]: V2 direct template link auth access', async ({ page }) => {
  const { user, team } = await seedUser();

  const directTemplateWithAuth = await seedDirectTemplate({
    title: 'Personal direct template link',
    userId: user.id,
    teamId: team.id,
    internalVersion: 2,
    createTemplateOptions: {
      authOptions: createDocumentAuthOptions({
        globalAccessAuth: ['ACCOUNT'],
        globalActionAuth: [],
      }),
    },
  });

  const directTemplatePath = formatDirectTemplatePath(directTemplateWithAuth.directLink?.token || '');

  await page.goto(directTemplatePath);

  await expect(page.getByText('Authentication required')).toBeVisible();

  await apiSignin({
    page,
    email: user.email,
  });

  await page.goto(directTemplatePath);

  await expect(page.getByRole('heading', { name: 'Personal direct template link' })).toBeVisible();

  const directSignatureField = directTemplateWithAuth.fields[0];

  if (!directSignatureField) {
    throw new Error('Expected seeded direct template signature field to exist');
  }

  // Wait for the PDF and the Konva canvas overlay to be ready.
  await expect(page.locator('img[data-page-number]').first()).toBeVisible({ timeout: 30_000 });
  const canvas = page.locator('.konva-container canvas').first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  // Sign the direct template recipient's signature field via the canvas-based V2 UI.
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
  await expect(page.getByLabel('Your Email')).not.toBeVisible();

  await page.getByRole('button', { name: 'Sign' }).click();
  await page.waitForURL(/\/sign/);
  await expect(page.getByRole('heading', { name: 'Document Signed' })).toBeVisible();
});

test('[DIRECT_TEMPLATES]: use direct template link with 1 recipient', async ({ page }) => {
  const { team, owner, organisation } = await seedTeam({
    createTeamMembers: 1,
  });

  // Should be visible to team members.
  const template = await seedDirectTemplate({
    title: 'Team direct template link 1',
    userId: owner.id,
    teamId: team.id,
  });

  // Check that the direct template link is accessible.
  await page.goto(formatDirectTemplatePath(template.directLink?.token || ''));
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

  await page.waitForTimeout(100);
  await page.getByPlaceholder('recipient@documenso.com').fill(seedTestEmail());

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('Next Recipient Name')).not.toBeVisible();

  const directSignatureField = template.fields[0];

  if (!directSignatureField) {
    throw new Error('Expected seeded direct template signature field to exist');
  }

  await signSignaturePad(page);
  await page.locator(`#field-${directSignatureField.id}`).getByRole('button').click();
  await expect(page.locator(`#field-${directSignatureField.id}`)).toHaveAttribute('data-inserted', 'true');

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click();
  await page.waitForURL(/\/sign/);
  await expect(page.getByRole('heading', { name: 'Document Signed' })).toBeVisible();

  // Add a longer waiting period to ensure document status is updated
  await page.waitForTimeout(3000);
});

test('[DIRECT_TEMPLATES]: V1 use direct template link with 2 recipients with next signer dictation', async ({
  page,
}) => {
  const { team, owner, organisation } = await seedTeam({
    createTeamMembers: 1,
  });

  // Should be visible to team members.
  const template = await seedDirectTemplate({
    title: 'Team direct template link 1',
    userId: owner.id,
    teamId: team.id,
  });

  await prisma.documentMeta.update({
    where: {
      id: template.documentMetaId,
    },
    data: {
      allowDictateNextSigner: true,
      signingOrder: DocumentSigningOrder.SEQUENTIAL,
    },
  });

  // The seeded direct template already includes a signature field for the direct recipient.
  const directSignatureField = template.fields[0];

  if (!directSignatureField) {
    throw new Error('Expected seeded direct template signature field to exist');
  }

  const originalName = 'Signer 2';
  const originalSecondSignerEmail = seedTestEmail();

  // Add another signer
  const secondRecipient = await prisma.recipient.create({
    data: {
      signingOrder: 2,
      envelopeId: template.id,
      email: originalSecondSignerEmail,
      name: originalName,
      token: Math.random().toString().slice(2, 7),
      role: RecipientRole.SIGNER,
    },
  });

  await seedSignatureFieldForRecipient({
    envelopeId: template.id,
    recipientId: secondRecipient.id,
    positionY: 20,
  });

  // Check that the direct template link is accessible.
  await page.goto(formatDirectTemplatePath(template.directLink?.token || ''));
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

  await page.waitForTimeout(100);
  await page.getByPlaceholder('recipient@documenso.com').fill(seedTestEmail());

  await page.getByRole('button', { name: 'Continue' }).click();

  // Sign the direct template recipient's signature field via the UI.
  await signSignaturePad(page);
  await page.locator(`#field-${directSignatureField.id}`).getByRole('button').click();
  await expect(page.locator(`#field-${directSignatureField.id}`)).toHaveAttribute('data-inserted', 'true');

  await page.getByRole('button', { name: 'Complete' }).click();

  await expect(page.getByText('Next Recipient Name')).toBeVisible();

  const nextRecipientNameInputValue = await page.getByLabel('Next Recipient Name').inputValue();
  expect(nextRecipientNameInputValue).toBe(originalName);

  const nextRecipientEmailInputValue = await page.getByLabel('Next Recipient Email').inputValue();
  expect(nextRecipientEmailInputValue).toBe(originalSecondSignerEmail);

  const newName = 'Hello';
  const newSecondSignerEmail = seedTestEmail();

  await page.getByLabel('Next Recipient Email').fill(newSecondSignerEmail);
  await page.getByLabel('Next Recipient Name').fill(newName);

  await page.getByRole('button', { name: 'Sign' }).click();
  await page.waitForURL(/\/sign/);
  await expect(page.getByRole('heading', { name: 'Document Signed' })).toBeVisible();

  const createdEnvelopeRecipients = await prisma.recipient.findMany({
    where: {
      envelope: {
        templateId: mapSecondaryIdToTemplateId(template.secondaryId),
      },
    },
  });

  const updatedSecondRecipient = createdEnvelopeRecipients.find((recipient) => recipient.signingOrder === 2);

  expect(updatedSecondRecipient).toBeDefined();

  if (!updatedSecondRecipient) {
    throw new Error('Expected second recipient to exist');
  }

  expect(updatedSecondRecipient.name).toBe(newName);
  expect(updatedSecondRecipient.email).toBe(newSecondSignerEmail);
  await expectSigningRequestJobForRecipient(updatedSecondRecipient.id);
});

test('[DIRECT_TEMPLATES]: V2 use direct template link with 2 recipients with next signer dictation', async ({
  page,
}) => {
  const { team, owner, organisation } = await seedTeam({
    createTeamMembers: 1,
  });

  // Should be visible to team members.
  const template = await seedDirectTemplate({
    title: 'Team direct template link 1',
    userId: owner.id,
    teamId: team.id,
    internalVersion: 2,
  });

  await prisma.documentMeta.update({
    where: {
      id: template.documentMetaId,
    },
    data: {
      allowDictateNextSigner: true,
      signingOrder: DocumentSigningOrder.SEQUENTIAL,
    },
  });

  // The seeded direct template already includes a signature field for the direct recipient.
  const directSignatureField = template.fields[0];

  if (!directSignatureField) {
    throw new Error('Expected seeded direct template signature field to exist');
  }

  const originalName = 'Signer 2';
  const originalSecondSignerEmail = seedTestEmail();

  // Add another signer
  const secondRecipient = await prisma.recipient.create({
    data: {
      signingOrder: 2,
      envelopeId: template.id,
      email: originalSecondSignerEmail,
      name: originalName,
      token: Math.random().toString().slice(2, 7),
      role: RecipientRole.SIGNER,
    },
  });

  await seedSignatureFieldForRecipient({
    envelopeId: template.id,
    recipientId: secondRecipient.id,
    positionY: 20,
  });

  // Check that the direct template link is accessible.
  await page.goto(formatDirectTemplatePath(template.directLink?.token || ''));
  await expect(page.getByRole('heading', { name: 'Team direct template link 1' })).toBeVisible();

  // Wait for the PDF and the Konva canvas overlay to be ready.
  await expect(page.locator('img[data-page-number]').first()).toBeVisible({ timeout: 30_000 });
  const canvas = page.locator('.konva-container canvas').first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  // Sign the direct template recipient's signature field via the canvas-based V2 UI.
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

  const currentName = 'John Doe';
  const currentEmail = seedTestEmail();

  await page.getByPlaceholder('Enter Your Name').fill(currentName);
  await page.getByPlaceholder('Enter Your Email').fill(currentEmail);

  await expect(page.getByText('Next Recipient Name')).toBeVisible();

  const nextRecipientNameInputValue = await page.getByLabel('Next Recipient Name').inputValue();
  expect(nextRecipientNameInputValue).toBe(originalName);

  const nextRecipientEmailInputValue = await page.getByLabel('Next Recipient Email').inputValue();
  expect(nextRecipientEmailInputValue).toBe(originalSecondSignerEmail);

  const newName = 'Hello';
  const newSecondSignerEmail = seedTestEmail();

  await page.getByLabel('Next Recipient Email').fill(newSecondSignerEmail);
  await page.getByLabel('Next Recipient Name').fill(newName);

  await page.getByRole('button', { name: 'Sign' }).click();
  await page.waitForURL(/\/sign/);
  await expect(page.getByRole('heading', { name: 'Document Signed' })).toBeVisible();

  const createdEnvelopeRecipients = await prisma.recipient.findMany({
    where: {
      envelope: {
        templateId: mapSecondaryIdToTemplateId(template.secondaryId),
      },
    },
  });

  const updatedSecondRecipient = createdEnvelopeRecipients.find((recipient) => recipient.signingOrder === 2);

  expect(updatedSecondRecipient).toBeDefined();

  if (!updatedSecondRecipient) {
    throw new Error('Expected second recipient to exist');
  }

  expect(updatedSecondRecipient.name).toBe(newName);
  expect(updatedSecondRecipient.email).toBe(newSecondSignerEmail);
  await expectSigningRequestJobForRecipient(updatedSecondRecipient.id);
});

test('[DIRECT_TEMPLATES]: V1 direct template without signature fields shows invalid template page', async ({
  page,
}) => {
  const { user, team } = await seedUser();

  const template = await seedDirectTemplate({
    title: 'V1 invalid direct template',
    userId: user.id,
    teamId: team.id,
    createDirectRecipientSignatureField: false,
  });

  await page.goto(formatDirectTemplatePath(template.directLink?.token || ''));

  await expect(page.getByRole('heading', { name: 'Invalid direct link template' })).toBeVisible();
  await expect(page.getByText('This direct link template cannot be used because one or more signers')).toBeVisible();

  // The signing flow must not render.
  await expect(page.getByRole('heading', { name: 'General' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).not.toBeVisible();
});

test('[DIRECT_TEMPLATES]: V2 direct template without signature fields shows invalid template page', async ({
  page,
}) => {
  const { user, team } = await seedUser();

  const template = await seedDirectTemplate({
    title: 'V2 invalid direct template',
    userId: user.id,
    teamId: team.id,
    internalVersion: 2,
    createDirectRecipientSignatureField: false,
  });

  await page.goto(formatDirectTemplatePath(template.directLink?.token || ''));

  await expect(page.getByRole('heading', { name: 'Invalid direct link template' })).toBeVisible();
  await expect(page.getByText('This direct link template cannot be used because one or more signers')).toBeVisible();

  // The signing flow (PDF canvas) must not render.
  await expect(page.locator('.konva-container canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Complete' })).not.toBeVisible();
});

test('[DIRECT_TEMPLATES]: V1 advanced field values sent by the signing page are accepted', async ({ page }) => {
  const { team, owner } = await seedTeam();

  const template = await seedDirectTemplate({
    title: 'V1 advanced fields',
    userId: owner.id,
    teamId: team.id,
  });

  const [directRecipient] = template.recipients;
  const [directSignatureField] = template.fields;

  const secondRecipient = await prisma.recipient.create({
    data: {
      envelopeId: template.id,
      email: seedTestEmail(),
      name: 'Second Signer',
      token: nanoid(),
      role: RecipientRole.SIGNER,
    },
  });

  await seedSignatureFieldForRecipient({
    envelopeId: template.id,
    recipientId: secondRecipient.id,
    positionY: 10,
  });

  // Each is sent by the page in a form the server has to recognise: read only fields, pre-set
  // values, an option without a label, and labels with a comma or surrounding spaces.
  const fieldMetaByExternalId: FieldMetaByExternalId = {
    notice: { type: 'text', readOnly: true, text: 'Fixed text' },
    quantity: { type: 'number', value: '7', minValue: 1, maxValue: 10 },
    size: { type: 'dropdown', values: [{ value: 'Small' }, { value: 'Large' }], defaultValue: 'Large' },
    extras: {
      type: 'checkbox',
      readOnly: true,
      values: [
        { id: 1, checked: true, value: 'A, B' },
        { id: 2, checked: true, value: '' },
        { id: 3, checked: false, value: 'C' },
      ],
    },
    answer: {
      type: 'radio',
      values: [
        { id: 1, checked: false, value: '' },
        { id: 2, checked: false, value: 'No' },
      ],
    },
    temperature: {
      type: 'radio',
      values: [
        { id: 1, checked: false, value: 'Cold' },
        { id: 2, checked: false, value: ' Warm ' },
      ],
    },
  };

  for (const recipient of [directRecipient, secondRecipient]) {
    await seedAdvancedFieldsForRecipient({
      envelopeId: template.id,
      recipientId: recipient.id,
      fieldMetaByExternalId,
    });
  }

  const fillAdvancedFields = async (recipientId: number) => {
    const fields = await prisma.field.findMany({
      where: {
        recipientId,
      },
    });

    const fieldLocator = (externalId: string) =>
      page.locator(`#field-${fields.find((field) => field.externalId === externalId)?.id}`);

    const optionLocator = (externalId: string, optionId: number) =>
      page.locator(`#option-${fields.find((field) => field.externalId === externalId)?.id}-${optionId}`);

    // The page fills these in by itself: they are read only or have a pre-set value.
    for (const externalId of ['notice', 'quantity', 'size', 'extras']) {
      await expect(fieldLocator(externalId)).toHaveAttribute('data-inserted', 'true');
    }

    // One at a time, since the direct template page keeps the values in state and loses one
    // written while another is still pending.
    await optionLocator('answer', 1).click();
    await expect(fieldLocator('answer')).toHaveAttribute('data-inserted', 'true');

    await optionLocator('temperature', 2).click();
    await expect(fieldLocator('temperature')).toHaveAttribute('data-inserted', 'true');
  };

  const directRecipientEmail = seedTestEmail();

  await page.goto(formatDirectTemplatePath(template.directLink?.token || ''));
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

  await page.waitForTimeout(100);
  await page.getByPlaceholder('recipient@documenso.com').fill(directRecipientEmail);

  await page.getByRole('button', { name: 'Continue' }).click();

  await fillAdvancedFields(directRecipient.id);

  await signSignaturePad(page);
  await page.locator(`#field-${directSignatureField.id}`).getByRole('button').click();
  await expect(page.locator(`#field-${directSignatureField.id}`)).toHaveAttribute('data-inserted', 'true');

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click();
  await page.waitForURL(/\/sign/);
  await expect(page.getByRole('heading', { name: 'Document Signed' })).toBeVisible();

  const findCreatedRecipient = async (email: string) =>
    await prisma.recipient.findFirstOrThrow({
      where: {
        email,
        envelope: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
        },
      },
    });

  const createdDirectRecipient = await findCreatedRecipient(directRecipientEmail);
  const createdSecondRecipient = await findCreatedRecipient(secondRecipient.email);

  await page.goto(`/sign/${createdSecondRecipient.token}`);

  await fillAdvancedFields(createdSecondRecipient.id);

  const expectedValues = {
    notice: 'Fixed text',
    quantity: '7',
    size: 'Large',
    extras: '["A, B","empty-value-2"]',
    answer: 'empty-value-1',
  };

  expect(await findInsertedValues({ recipientId: createdDirectRecipient.id })).toEqual({
    ...expectedValues,
    temperature: ' Warm ',
  });

  // The signing route trims the value it receives.
  expect(await findInsertedValues({ recipientId: createdSecondRecipient.id })).toEqual({
    ...expectedValues,
    temperature: 'Warm',
  });
});

test('[DIRECT_TEMPLATES]: V2 stores the value the sender set for a read only field, whatever is submitted', async ({
  request,
}) => {
  const template = await seedDirectTemplateWithAdvancedFields({
    internalVersion: 2,
    fieldMetaByExternalId: {
      price: { type: 'text', readOnly: true, text: 'Price: 100 EUR' },
      plan: {
        type: 'radio',
        readOnly: true,
        values: [
          { id: 1, checked: false, value: 'Basic' },
          { id: 2, checked: true, value: 'Premium' },
        ],
      },
    },
  });

  // V2 stores a radio as the index of its option, and the sender checked the second one.
  const senderValues = { price: 'Price: 100 EUR', plan: '1' };

  const submissions = {
    unchanged: senderValues,
    forged: { price: 'Price: 1 EUR', plan: '0' },
    blank: { price: '', plan: '' },
    omitted: {},
  };

  for (const [description, values] of Object.entries(submissions)) {
    const response = await submitDirectLink(request, template.id, values);

    expect(response.status(), description).toBe(200);
    expect(await findCreatedDocumentValues(response), description).toEqual(senderValues);
  }
});

test('[DIRECT_TEMPLATES]: V2 accepts values the field settings allow and rejects the rest', async ({ request }) => {
  const template = await seedDirectTemplateWithAdvancedFields({
    internalVersion: 2,
    fieldMetaByExternalId: {
      amount: { type: 'number', required: true, minValue: 1, maxValue: 100 },
      size: { type: 'dropdown', required: true, values: [{ value: 'Small' }, { value: 'Large' }] },
      answer: {
        type: 'radio',
        required: true,
        values: [
          { id: 1, checked: false, value: 'Yes' },
          { id: 2, checked: false, value: 'No' },
        ],
      },
      consent: {
        type: 'checkbox',
        required: true,
        values: [
          { id: 1, checked: false, value: 'Terms' },
          { id: 2, checked: false, value: 'Privacy' },
        ],
      },
      code: { type: 'text', required: true, characterLimit: 5 },
      fit: { type: 'dropdown', values: [{ value: 'Slim ' }, { value: 'Regular' }] },
    },
  });

  const validValues = { amount: ' 50,5 ', size: 'Small', answer: '1', consent: '[0]', code: 'abcde', fit: 'Slim ' };

  const validResponse = await submitDirectLink(request, template.id, validValues);

  expect(validResponse.status()).toBe(200);

  // A number is trimmed. An option is not, since it may itself end in a space.
  expect(await findCreatedDocumentValues(validResponse)).toEqual({ ...validValues, amount: '50,5' });

  const invalidValues: Array<[description: string, value: Partial<typeof validValues>]> = [
    ['number above its maximum', { amount: '999999' }],
    ['number above its maximum written with separators', { amount: '1,000,000' }],
    ['number which may be read as above its maximum', { amount: '1.500' }],
    ['dropdown value which is not an option', { size: 'Injected' }],
    ['radio option which does not exist', { answer: '7' }],
    ['radio value which is not an option index', { answer: 'not-an-option' }],
    ['required checkbox with nothing ticked', { consent: '[]' }],
    ['text over its character limit', { code: 'abcdef' }],
  ];

  for (const [description, value] of invalidValues) {
    const response = await submitDirectLink(request, template.id, { ...validValues, ...value });

    expect.soft(response.status(), description).toBe(400);
  }
});

test('[DIRECT_TEMPLATES]: V2 only accepts a signature the template settings allow', async ({ request }) => {
  const template = await seedDirectTemplateWithAdvancedFields({
    internalVersion: 2,
    fieldMetaByExternalId: {},
    typedSignatureEnabled: false,
  });

  const signatures: Array<[description: string, signature: DirectLinkSignature, expectedStatus: number]> = [
    ['drawn', DRAWN_SIGNATURE, 200],
    ['typed', TYPED_SIGNATURE, 400],
    ['typed, claiming to be an image', { value: 'not-an-image', isBase64: true }, 400],
    ['empty', { value: '', isBase64: false }, 400],
  ];

  for (const [description, signature, expectedStatus] of signatures) {
    const response = await submitDirectLink(request, template.id, {}, signature);

    expect.soft(response.status(), description).toBe(expectedStatus);
  }
});

test('[DIRECT_TEMPLATES]: V1 stores the value the sender set for a read only field, whatever is submitted', async ({
  request,
}) => {
  const template = await seedDirectTemplateWithAdvancedFields({
    internalVersion: 1,
    fieldMetaByExternalId: {
      price: { type: 'text', readOnly: true, text: 'Price: 100 EUR' },
      quantity: { type: 'number', readOnly: true, value: '3' },
      size: {
        type: 'dropdown',
        readOnly: true,
        values: [{ value: 'Small' }, { value: 'Large' }],
        defaultValue: 'Large',
      },
      plan: {
        type: 'radio',
        readOnly: true,
        values: [
          { id: 1, checked: false, value: 'Basic' },
          { id: 2, checked: true, value: 'Premium' },
        ],
      },
      extras: {
        type: 'checkbox',
        readOnly: true,
        values: [
          { id: 1, checked: true, value: 'Insurance' },
          { id: 2, checked: false, value: 'Delivery' },
          { id: 3, checked: true, value: '' },
        ],
      },
    },
  });

  // V1 stores an option as its label, or as `empty-value-<id>` when it has none.
  const senderValues = {
    price: 'Price: 100 EUR',
    quantity: '3',
    size: 'Large',
    plan: 'Premium',
    extras: '["Insurance","empty-value-3"]',
  };

  const submissions = {
    unchanged: senderValues,
    forged: { price: 'Price: 1 EUR', quantity: '1', size: 'Small', plan: 'Basic', extras: '["Delivery"]' },
    blank: { price: '', quantity: '', size: '', plan: '', extras: '' },
    omitted: {},
  };

  for (const [description, values] of Object.entries(submissions)) {
    const response = await submitDirectLink(request, template.id, values);

    expect(response.status(), description).toBe(200);
    expect(await findCreatedDocumentValues(response), description).toEqual(senderValues);
  }
});

test('[DIRECT_TEMPLATES]: V1 accepts values the field settings allow and rejects the rest', async ({ request }) => {
  const template = await seedDirectTemplateWithAdvancedFields({
    internalVersion: 1,
    typedSignatureEnabled: false,
    fieldMetaByExternalId: {
      amount: { type: 'number', required: true, minValue: 1, maxValue: 100 },
      size: { type: 'dropdown', required: true, values: [{ value: 'Small' }, { value: 'Large' }] },
      answer: {
        type: 'radio',
        required: true,
        values: [
          { id: 1, checked: false, value: 'Yes' },
          { id: 2, checked: false, value: 'No' },
        ],
      },
      consent: {
        type: 'checkbox',
        required: true,
        values: [
          { id: 1, checked: false, value: 'Terms' },
          { id: 2, checked: false, value: 'Privacy, cookies' },
          { id: 3, checked: false, value: '' },
        ],
      },
      code: { type: 'text', required: true, characterLimit: 5 },
      fit: { type: 'dropdown', values: [{ value: 'Slim ' }, { value: 'Regular' }] },
    },
  });

  // As the V1 signing page sends them: an option as its label, or as `empty-value-<id>` when it
  // has none, and a checkbox as a JSON list.
  const validValues = {
    amount: '50',
    size: 'Small',
    answer: 'Yes',
    consent: '["Privacy, cookies","empty-value-3"]',
    code: 'abcde',
    fit: 'Slim ',
  };

  const validResponse = await submitDirectLink(request, template.id, validValues, DRAWN_SIGNATURE);

  expect(validResponse.status()).toBe(200);
  expect(await findCreatedDocumentValues(validResponse)).toEqual(validValues);

  const invalidValues: Array<[description: string, value: Partial<typeof validValues>]> = [
    ['number above its maximum', { amount: '999999' }],
    ['number above its maximum written with separators', { amount: '1,000,000' }],
    ['dropdown value which is not an option', { size: 'Injected' }],
    ['radio value which is not an option', { answer: 'Maybe' }],
    ['required radio left blank', { answer: '' }],
    ['checkbox value which is not an option', { consent: '["Terms","Injected"]' }],
    ['checkbox option repeated beyond its options', { consent: '["Terms","Terms"]' }],
    ['required checkbox with nothing ticked', { consent: '[]' }],
    ['text over its character limit', { code: 'abcdef' }],
  ];

  for (const [description, value] of invalidValues) {
    const response = await submitDirectLink(request, template.id, { ...validValues, ...value }, DRAWN_SIGNATURE);

    expect.soft(response.status(), description).toBe(400);
  }

  const invalidSignatures: Array<[description: string, signature: DirectLinkSignature]> = [
    ['typed signature when typing is disabled', TYPED_SIGNATURE],
    ['typed signature claiming to be an image', { value: 'not-an-image', isBase64: true }],
  ];

  for (const [description, signature] of invalidSignatures) {
    const response = await submitDirectLink(request, template.id, validValues, signature);

    expect.soft(response.status(), description).toBe(400);
  }
});
