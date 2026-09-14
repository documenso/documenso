import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import {
  EnvelopeContentType,
  type TEnvelopeContentMetaInput,
  ZEnvelopeContentMetaSchema,
} from '@documenso/lib/types/envelope-content-meta';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({
  mode: 'parallel',
});

/**
 * The editor hides the palette once a limit is reached, so these cover the
 * server side of that rule: the API is the only way to push an envelope past
 * its organisation's allowance.
 */

const textMeta = (index: number): TEnvelopeContentMetaInput => ({
  type: EnvelopeContentType.TEXT,
  page: 1,
  rotation: 0,
  positionX: 10,
  positionY: 10,
  width: 20,
  height: 6,
  text: `Content ${index}`,
});

const imageMeta = (): TEnvelopeContentMetaInput => ({
  type: EnvelopeContentType.IMAGE,
  page: 1,
  rotation: 0,
  positionX: 10,
  positionY: 30,
  width: 20,
  height: 10,
});

const setOrganisationContentLimits = async (
  teamId: number,
  limits: { envelopeContentCount?: number; envelopeContentImageCount?: number },
) => {
  const team = await prisma.team.findFirstOrThrow({ where: { id: teamId } });

  const organisationClaim = await prisma.organisationClaim.findFirstOrThrow({
    where: { organisation: { id: team.organisationId } },
  });

  await prisma.organisationClaim.update({ where: { id: organisationClaim.id }, data: limits });
};

/**
 * Seed contents straight onto the envelope, bypassing the limit check, to set
 * up an envelope which is already over its allowance.
 */
const seedContents = async (envelopeId: string, envelopeItemId: string, count: number, images = 0) => {
  await prisma.envelopeContent.createMany({
    data: Array.from({ length: count }).map((_, index) => ({
      id: generateDatabaseId('envelope_content'),
      envelopeId,
      envelopeItemId,
      metadata: ZEnvelopeContentMetaSchema.parse(index < images ? imageMeta() : textMeta(index)),
    })),
  });
};

const setContents = async (
  page: Page,
  teamId: number,
  envelopeId: string,
  contents: { id?: string; envelopeItemId: string; metadata: TEnvelopeContentMetaInput; zIndex?: number }[],
) =>
  await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/envelope.content.set`, {
    headers: { 'content-type': 'application/json', 'x-team-id': teamId.toString() },
    data: JSON.stringify({ json: { envelopeId, contents } }),
  });

const getContentCount = async (envelopeId: string) => await prisma.envelopeContent.count({ where: { envelopeId } });

const setupEnvelope = async (
  page: Page,
  limits: { envelopeContentCount?: number; envelopeContentImageCount?: number },
) => {
  const { user, team } = await seedUser();

  const document = await seedBlankDocument(user, team.id, { internalVersion: 2 });

  await setOrganisationContentLimits(team.id, limits);

  await apiSignin({ page, email: user.email, redirectPath: `/t/${team.url}/documents` });

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: { id: document.id },
    include: { envelopeItems: true },
  });

  return { envelope, envelopeItemId: envelope.envelopeItems[0].id, teamId: team.id };
};

test('rejects a save which exceeds the content limit', async ({ page }) => {
  const { envelope, envelopeItemId, teamId } = await setupEnvelope(page, { envelopeContentCount: 2 });

  const withinLimit = await setContents(
    page,
    teamId,
    envelope.id,
    Array.from({ length: 2 }).map((_, index) => ({ envelopeItemId, metadata: textMeta(index) })),
  );

  expect(withinLimit.ok()).toBeTruthy();
  expect(await getContentCount(envelope.id)).toBe(2);

  const overLimit = await setContents(
    page,
    teamId,
    envelope.id,
    Array.from({ length: 3 }).map((_, index) => ({ envelopeItemId, metadata: textMeta(index) })),
  );

  expect(overLimit.status()).toBe(400);
  expect(await overLimit.text()).toContain('ENVELOPE_CONTENT_LIMIT_EXCEEDED');

  // The rejected save left the envelope untouched.
  expect(await getContentCount(envelope.id)).toBe(2);
});

test('rejects a save which exceeds the image content limit', async ({ page }) => {
  const { envelope, envelopeItemId, teamId } = await setupEnvelope(page, { envelopeContentImageCount: 1 });

  const overLimit = await setContents(page, teamId, envelope.id, [
    { envelopeItemId, metadata: imageMeta() },
    { envelopeItemId, metadata: imageMeta() },
  ]);

  expect(overLimit.status()).toBe(400);
  expect(await overLimit.text()).toContain('ENVELOPE_CONTENT_IMAGE_LIMIT_EXCEEDED');

  expect(await getContentCount(envelope.id)).toBe(0);
});

/**
 * An envelope can end up over its limit without being edited, e.g. after the
 * organisation's plan is lowered, so removals must keep working.
 */
test('allows an over limit envelope to be trimmed back down', async ({ page }) => {
  const { envelope, envelopeItemId, teamId } = await setupEnvelope(page, { envelopeContentCount: 2 });

  await seedContents(envelope.id, envelopeItemId, 5);

  const existing = await prisma.envelopeContent.findMany({
    where: { envelopeId: envelope.id },
    orderBy: { id: 'asc' },
  });

  // Removing one while still over the limit is allowed.
  const trimmed = await setContents(
    page,
    teamId,
    envelope.id,
    existing.slice(0, 4).map((content) => ({
      id: content.id,
      envelopeItemId,
      metadata: textMeta(0),
    })),
  );

  expect(trimmed.ok()).toBeTruthy();
  expect(await getContentCount(envelope.id)).toBe(4);

  // Adding while over the limit is still refused.
  const added = await setContents(page, teamId, envelope.id, [
    ...existing.slice(0, 4).map((content) => ({ id: content.id, envelopeItemId, metadata: textMeta(0) })),
    { envelopeItemId, metadata: textMeta(99) },
  ]);

  expect(added.status()).toBe(400);
  expect(await getContentCount(envelope.id)).toBe(4);

  // And once back within the allowance everything works normally again.
  const backWithin = await setContents(
    page,
    teamId,
    envelope.id,
    existing.slice(0, 2).map((content) => ({ id: content.id, envelopeItemId, metadata: textMeta(0) })),
  );

  expect(backWithin.ok()).toBeTruthy();
  expect(await getContentCount(envelope.id)).toBe(2);
});

test('rejects a stacking order which would not fit the column', async ({ page }) => {
  const { envelope, envelopeItemId, teamId } = await setupEnvelope(page, {});

  const res = await setContents(page, teamId, envelope.id, [
    { envelopeItemId, metadata: textMeta(0), zIndex: 2_147_483_648 },
  ]);

  expect(res.ok()).toBeFalsy();
  expect(await getContentCount(envelope.id)).toBe(0);
});
