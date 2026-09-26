import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { EnvelopeContentType, type TEnvelopeContentMetaInput } from '@documenso/lib/types/envelope-content-meta';
import { prefixedId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({
  mode: 'parallel',
});

/**
 * Contents are burned into the signed PDF, so authoring them is recorded the
 * same way authoring a field is.
 *
 * The audit log type names are written out rather than imported because the
 * module which declares them carries lingui macros the test runner cannot
 * transform.
 */

const textMeta = (overrides: Partial<TEnvelopeContentMetaInput> = {}): TEnvelopeContentMetaInput => ({
  type: EnvelopeContentType.TEXT,
  page: 1,
  rotation: 0,
  positionX: 10,
  positionY: 10,
  width: 20,
  height: 6,
  text: 'Approved',
  ...overrides,
});

const setContents = async (
  page: Page,
  teamId: number,
  envelopeId: string,
  contents: {
    id?: string;
    envelopeItemId: string;
    contentMeta: TEnvelopeContentMetaInput;
    dataContentId?: string | null;
  }[],
) =>
  await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/envelope.content.set`, {
    headers: { 'content-type': 'application/json', 'x-team-id': teamId.toString() },
    data: JSON.stringify({
      json: { envelopeId, contents: contents.map((content) => ({ dataContentId: null, ...content })) },
    }),
  });

const getContentAuditLogs = async (envelopeId: string) =>
  await prisma.documentAuditLog.findMany({
    where: { envelopeId, type: { startsWith: 'CONTENT_' } },
    orderBy: { createdAt: 'asc' },
  });

const setupEnvelope = async (page: Page, type: 'document' | 'template' = 'document') => {
  const { user, team } = await seedUser();

  const envelopeRecord =
    type === 'document'
      ? await seedBlankDocument(user, team.id, { internalVersion: 2 })
      : await seedBlankTemplate(user, team.id, { internalVersion: 2 });

  await apiSignin({ page, email: user.email, redirectPath: `/t/${team.url}/documents` });

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: { id: envelopeRecord.id },
    include: { envelopeItems: true },
  });

  return { envelope, envelopeItemId: envelope.envelopeItems[0].id, teamId: team.id };
};

test('logs a created content', async ({ page }) => {
  const { envelope, envelopeItemId, teamId } = await setupEnvelope(page);

  const res = await setContents(page, teamId, envelope.id, [{ envelopeItemId, contentMeta: textMeta() }]);

  expect(res.ok()).toBeTruthy();

  const content = await prisma.envelopeContent.findFirstOrThrow({ where: { envelopeId: envelope.id } });

  const logs = await getContentAuditLogs(envelope.id);

  expect(logs).toHaveLength(1);
  expect(logs[0].type).toBe('CONTENT_CREATED');
  expect(logs[0].data).toMatchObject({
    contentId: content.id,
    contentType: EnvelopeContentType.TEXT,
    envelopeItemId,
    contentMeta: content.contentMeta,
    dataContentId: null,
  });
});

test('logs a moved content as updated, recording the position', async ({ page }) => {
  const { envelope, envelopeItemId, teamId } = await setupEnvelope(page);

  await setContents(page, teamId, envelope.id, [{ envelopeItemId, contentMeta: textMeta() }]);

  const content = await prisma.envelopeContent.findFirstOrThrow({ where: { envelopeId: envelope.id } });

  const res = await setContents(page, teamId, envelope.id, [
    { id: content.id, envelopeItemId, contentMeta: textMeta({ positionX: 55, page: 1 }) },
  ]);

  expect(res.ok()).toBeTruthy();

  const logs = await getContentAuditLogs(envelope.id);

  expect(logs.map((log) => log.type)).toEqual(['CONTENT_CREATED', 'CONTENT_UPDATED']);
  expect(logs[1].data).toMatchObject({
    contentId: content.id,
    changes: [{ type: 'PROPERTY', key: 'positionX', from: 10, to: 55 }],
  });
});

test('logs an edited text as updated', async ({ page }) => {
  const { envelope, envelopeItemId, teamId } = await setupEnvelope(page);

  await setContents(page, teamId, envelope.id, [{ envelopeItemId, contentMeta: textMeta() }]);

  const content = await prisma.envelopeContent.findFirstOrThrow({ where: { envelopeId: envelope.id } });

  const res = await setContents(page, teamId, envelope.id, [
    { id: content.id, envelopeItemId, contentMeta: textMeta({ text: 'Rejected' }) },
  ]);

  expect(res.ok()).toBeTruthy();

  const logs = await getContentAuditLogs(envelope.id);

  expect(logs.map((log) => log.type)).toEqual(['CONTENT_CREATED', 'CONTENT_UPDATED']);
  expect(logs[1].data).toMatchObject({
    contentId: content.id,
    changes: [{ type: 'PROPERTY', key: 'text', from: 'Approved', to: 'Rejected' }],
  });
});

test('logs a restyled content as updated', async ({ page }) => {
  const { envelope, envelopeItemId, teamId } = await setupEnvelope(page);

  await setContents(page, teamId, envelope.id, [{ envelopeItemId, contentMeta: textMeta({ color: '#000000' }) }]);

  const content = await prisma.envelopeContent.findFirstOrThrow({ where: { envelopeId: envelope.id } });

  await setContents(page, teamId, envelope.id, [
    { id: content.id, envelopeItemId, contentMeta: textMeta({ color: '#ff0000' }) },
  ]);

  const logs = await getContentAuditLogs(envelope.id);

  expect(logs[1].data).toMatchObject({
    changes: [{ type: 'PROPERTY', key: 'color', from: '#000000', to: '#ff0000' }],
  });
});

/**
 * A content belongs to the item it was created on. The diff which feeds the
 * audit log does not cover the item, so a move is refused outright rather
 * than applied without a record.
 */
test('rejects moving a content to another envelope item', async ({ page }) => {
  const { envelope, envelopeItemId, teamId } = await setupEnvelope(page);

  const firstItem = await prisma.envelopeItem.findFirstOrThrow({
    where: { id: envelopeItemId },
    include: { documentData: true },
  });

  const secondDocumentData = await prisma.documentData.create({
    data: {
      type: firstItem.documentData.type,
      data: firstItem.documentData.data,
      initialData: firstItem.documentData.initialData,
    },
  });

  const secondItem = await prisma.envelopeItem.create({
    data: {
      id: prefixedId('envelope_item'),
      title: `${firstItem.title} - 2`,
      documentDataId: secondDocumentData.id,
      order: 2,
      envelopeId: envelope.id,
    },
  });

  await setContents(page, teamId, envelope.id, [{ envelopeItemId, contentMeta: textMeta() }]);

  const content = await prisma.envelopeContent.findFirstOrThrow({ where: { envelopeId: envelope.id } });

  const res = await setContents(page, teamId, envelope.id, [
    { id: content.id, envelopeItemId: secondItem.id, contentMeta: textMeta() },
  ]);

  expect(res.status()).toBe(400);

  const reloaded = await prisma.envelopeContent.findFirstOrThrow({ where: { id: content.id } });

  expect(reloaded.envelopeItemId).toBe(envelopeItemId);

  const logs = await getContentAuditLogs(envelope.id);

  expect(logs.map((log) => log.type)).toEqual(['CONTENT_CREATED']);
});

test('does not log a save which changed nothing', async ({ page }) => {
  const { envelope, envelopeItemId, teamId } = await setupEnvelope(page);

  await setContents(page, teamId, envelope.id, [{ envelopeItemId, contentMeta: textMeta() }]);

  const content = await prisma.envelopeContent.findFirstOrThrow({ where: { envelopeId: envelope.id } });

  await setContents(page, teamId, envelope.id, [{ id: content.id, envelopeItemId, contentMeta: textMeta() }]);

  const logs = await getContentAuditLogs(envelope.id);

  expect(logs.map((log) => log.type)).toEqual(['CONTENT_CREATED']);
});

/**
 * Bringing a content to the front is an authoring action like any other
 * property change, so it is recorded. Merely selecting a content no longer
 * rewrites its order, so this is only logged when the order actually moves.
 */
test('logs a changed stacking order as updated', async ({ page }) => {
  const { envelope, envelopeItemId, teamId } = await setupEnvelope(page);

  await setContents(page, teamId, envelope.id, [{ envelopeItemId, contentMeta: textMeta() }]);

  const content = await prisma.envelopeContent.findFirstOrThrow({ where: { envelopeId: envelope.id } });

  const res = await setContents(page, teamId, envelope.id, [
    { id: content.id, envelopeItemId, contentMeta: textMeta({ zIndex: content.contentMeta.zIndex + 5 }) },
  ]);

  expect(res.ok()).toBeTruthy();

  const reloaded = await prisma.envelopeContent.findFirstOrThrow({ where: { id: content.id } });

  expect(reloaded.contentMeta.zIndex).toBe(content.contentMeta.zIndex + 5);

  const logs = await getContentAuditLogs(envelope.id);

  expect(logs.map((log) => log.type)).toEqual(['CONTENT_CREATED', 'CONTENT_UPDATED']);
  expect(logs[1].data).toMatchObject({
    contentId: content.id,
    changes: [
      { type: 'PROPERTY', key: 'zIndex', from: content.contentMeta.zIndex, to: content.contentMeta.zIndex + 5 },
    ],
  });
});

test('logs a removed content as deleted', async ({ page }) => {
  const { envelope, envelopeItemId, teamId } = await setupEnvelope(page);

  await setContents(page, teamId, envelope.id, [{ envelopeItemId, contentMeta: textMeta() }]);

  const content = await prisma.envelopeContent.findFirstOrThrow({ where: { envelopeId: envelope.id } });

  const res = await setContents(page, teamId, envelope.id, []);

  expect(res.ok()).toBeTruthy();

  const logs = await getContentAuditLogs(envelope.id);

  expect(logs.map((log) => log.type)).toEqual(['CONTENT_CREATED', 'CONTENT_DELETED']);
  expect(logs[1].data).toMatchObject({
    contentId: content.id,
    contentType: EnvelopeContentType.TEXT,
    envelopeItemId,
  });
});

/**
 * Templates are not audit logged, matching `setFieldsForTemplate`.
 */
test('does not log contents authored on a template', async ({ page }) => {
  const { envelope, envelopeItemId, teamId } = await setupEnvelope(page, 'template');

  const res = await setContents(page, teamId, envelope.id, [{ envelopeItemId, contentMeta: textMeta() }]);

  expect(res.ok()).toBeTruthy();
  expect(await prisma.envelopeContent.count({ where: { envelopeId: envelope.id } })).toBe(1);

  expect(await getContentAuditLogs(envelope.id)).toHaveLength(0);
});
