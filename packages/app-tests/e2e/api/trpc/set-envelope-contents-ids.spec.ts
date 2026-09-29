import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { EnvelopeContentType, type TEnvelopeContentMetaInput } from '@documenso/lib/types/envelope-content-meta';
import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';

import { apiSignin } from '../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({
  mode: 'parallel',
});

/**
 * The editor sends every content on every save, and the ones which already
 * exist are identified by their ID. An ID listed twice would update the same
 * content twice, so it is rejected. New contents have no ID, so any number of
 * them can be created in one save.
 */

const textMeta = (text: string, positionY = 10): TEnvelopeContentMetaInput => ({
  type: EnvelopeContentType.TEXT,
  page: 1,
  positionX: 10,
  positionY,
  width: 20,
  height: 6,
  text,
});

type SetContentInput = {
  id?: string;
  envelopeItemId: string;
  contentMeta: TEnvelopeContentMetaInput;
};

const setContents = async (page: Page, teamId: number, envelopeId: string, contents: SetContentInput[]) =>
  await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/envelope.content.set`, {
    headers: { 'content-type': 'application/json', 'x-team-id': teamId.toString() },
    data: JSON.stringify({
      json: { envelopeId, contents: contents.map((content) => ({ dataContentId: null, ...content })) },
    }),
  });

const setupDocument = async (page: Page) => {
  const { user, team } = await seedUser();

  const document = await seedBlankDocument(user, team.id, { internalVersion: 2 });

  await apiSignin({ page, email: user.email, redirectPath: `/t/${team.url}/documents` });

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: { id: document.id },
    include: { envelopeItems: true },
  });

  return { envelopeId: envelope.id, envelopeItemId: envelope.envelopeItems[0].id, teamId: team.id };
};

test('rejects a content listed twice without changing it', async ({ page }) => {
  const { envelopeId, envelopeItemId, teamId } = await setupDocument(page);

  const created = await setContents(page, teamId, envelopeId, [{ envelopeItemId, contentMeta: textMeta('Original') }]);

  expect(created.ok(), await created.text()).toBeTruthy();

  const content = await prisma.envelopeContent.findFirstOrThrow({ where: { envelopeId } });

  const res = await setContents(page, teamId, envelopeId, [
    { id: content.id, envelopeItemId, contentMeta: textMeta('First edit') },
    { id: content.id, envelopeItemId, contentMeta: textMeta('Second edit') },
  ]);

  expect(res.status()).toBe(400);
  expect(await res.text()).toContain('Content IDs must be unique');

  const contents = await prisma.envelopeContent.findMany({ where: { envelopeId } });

  expect(contents).toHaveLength(1);
  expect(contents[0].contentMeta).toEqual(content.contentMeta);
});

test('creates several new contents in one save', async ({ page }) => {
  const { envelopeId, envelopeItemId, teamId } = await setupDocument(page);

  const res = await setContents(page, teamId, envelopeId, [
    { envelopeItemId, contentMeta: textMeta('First', 10) },
    { envelopeItemId, contentMeta: textMeta('Second', 30) },
    { envelopeItemId, contentMeta: textMeta('Third', 50) },
  ]);

  expect(res.ok(), await res.text()).toBeTruthy();

  expect(await prisma.envelopeContent.count({ where: { envelopeId } })).toBe(3);
});
