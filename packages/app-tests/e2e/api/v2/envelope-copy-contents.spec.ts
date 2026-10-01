import fs from 'node:fs';
import path from 'node:path';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { EnvelopeContentType, type TEnvelopeContentMetaInput } from '@documenso/lib/types/envelope-content-meta';
import { nanoid } from '@documenso/lib/universal/id';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import type { TCreateEnvelopeResponse } from '@documenso/trpc/server/envelope-router/create-envelope.types';
import type { TDuplicateEnvelopeResponse } from '@documenso/trpc/server/envelope-router/duplicate-envelope.types';
import type {
  TUseEnvelopePayload,
  TUseEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/use-envelope.types';
import { type APIRequestContext, expect, test } from '@playwright/test';
import { EnvelopeType, FieldType, RecipientRole } from '@prisma/client';

import { createImageFile } from '../../fixtures/contents';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

test.describe.configure({
  mode: 'parallel',
});

/**
 * Duplicating an envelope, or creating a document from a template, copies the
 * contents onto the matching items of the new envelope. Images are shared
 * rather than copied, since a data content never changes.
 */

const examplePdfBuffer = fs.readFileSync(path.join(__dirname, '../../../../../assets/example.pdf'));

const textMeta = (text: string): TEnvelopeContentMetaInput => ({
  type: EnvelopeContentType.TEXT,
  page: 1,
  positionX: 10,
  positionY: 10,
  width: 40,
  height: 5,
  text,
});

const IMAGE_META: TEnvelopeContentMetaInput = {
  type: EnvelopeContentType.IMAGE,
  page: 1,
  positionX: 10,
  positionY: 40,
  width: 30,
  height: 10,
};

/**
 * Create an envelope with two files through the public create route, with a
 * text on each file and an image on the second.
 */
const createSourceEnvelope = async (
  request: APIRequestContext,
  token: string,
  type: EnvelopeType,
  options: { withSignerFields?: boolean } = {},
) => {
  const image = await createImageFile(`copy-${nanoid()}.png`, 120, 60);

  const formData = new FormData();

  formData.append(
    'payload',
    JSON.stringify({
      type,
      title: 'Envelope With Contents',
      recipients: options.withSignerFields
        ? [
            {
              email: `signer-${nanoid()}@test.documenso.com`,
              name: 'Signer',
              role: RecipientRole.SIGNER,
              fields: [
                { type: FieldType.SIGNATURE, page: 1, positionX: 10, positionY: 60, width: 10, height: 5 },
                { type: FieldType.NAME, page: 1, positionX: 10, positionY: 70, width: 10, height: 5 },
              ],
            },
          ]
        : undefined,
      contents: [
        { identifier: 'first.pdf', contentMeta: textMeta('On the first file') },
        { identifier: 'second.pdf', contentMeta: textMeta('On the second file') },
        { identifier: 'second.pdf', contentMeta: IMAGE_META, imageIndex: 0 },
      ],
    }),
  );

  for (const pdfName of ['first.pdf', 'second.pdf']) {
    formData.append('files', new File([examplePdfBuffer], pdfName, { type: 'application/pdf' }));
  }

  formData.append('contentImages', new File([image.buffer], image.name, { type: image.mimeType }));

  const res = await request.post(`${baseUrl}/envelope/create`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: formData,
  });

  expect(res.ok(), await res.text()).toBeTruthy();

  const { id } = (await res.json()) as TCreateEnvelopeResponse;

  return id;
};

/**
 * An envelope's contents, each described by the position of the item it is
 * on rather than the item's ID, so a copy can be compared with its source.
 *
 * Titles would not do, since creating a document from a template drops the
 * ".pdf" from them.
 */
const getContentSummaries = async (envelopeId: string) => {
  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelopeId },
    include: { envelopeItems: { orderBy: { order: 'asc' } }, contents: true },
  });

  return envelope.contents.map((content) => ({
    envelopeItemIndex: envelope.envelopeItems.findIndex((item) => item.id === content.envelopeItemId),
    contentMeta: content.contentMeta,
    dataContentId: content.dataContentId,
  }));
};

type CopyEnvelopeOptions = {
  request: APIRequestContext;
  token: string;
  sourceId: string;
  includeContents?: boolean;
};

type CopyRoute = {
  name: string;

  /**
   * The type of envelope the route copies.
   */
  sourceType: EnvelopeType;

  /**
   * Copy the source envelope, returning the ID of the new envelope.
   */
  copy: (options: CopyEnvelopeOptions) => Promise<string>;
};

const COPY_ROUTES: CopyRoute[] = [
  {
    name: 'envelope/duplicate',
    sourceType: EnvelopeType.DOCUMENT,
    copy: async ({ request, token, sourceId, includeContents }) => {
      const res = await request.post(`${baseUrl}/envelope/duplicate`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { envelopeId: sourceId, includeContents },
      });

      expect(res.ok(), await res.text()).toBeTruthy();

      const { id } = (await res.json()) as TDuplicateEnvelopeResponse;

      return id;
    },
  },
  {
    name: 'envelope/use',
    sourceType: EnvelopeType.TEMPLATE,
    copy: async ({ request, token, sourceId, includeContents }) => {
      const payload: TUseEnvelopePayload = { envelopeId: sourceId, includeContents };

      const formData = new FormData();

      formData.append('payload', JSON.stringify(payload));

      const res = await request.post(`${baseUrl}/envelope/use`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: formData,
      });

      expect(res.ok(), await res.text()).toBeTruthy();

      const { id } = (await res.json()) as TUseEnvelopeResponse;

      return id;
    },
  },
  {
    name: 'template/use',
    sourceType: EnvelopeType.TEMPLATE,
    copy: async ({ request, token, sourceId, includeContents }) => {
      const template = await prisma.envelope.findUniqueOrThrow({ where: { id: sourceId } });

      const res = await request.post(`${baseUrl}/template/use`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          templateId: mapSecondaryIdToTemplateId(template.secondaryId),
          recipients: [],
          includeContents,
        },
      });

      expect(res.ok(), await res.text()).toBeTruthy();

      const { envelopeId }: { envelopeId: string } = await res.json();

      return envelopeId;
    },
  },
];

const getCopyRoute = (name: string): CopyRoute => {
  const route = COPY_ROUTES.find((copyRoute) => copyRoute.name === name);

  if (!route) {
    throw new Error(`Unknown copy route ${name}`);
  }

  return route;
};

test.describe('Copy contents to new envelopes', () => {
  let token: string;

  test.beforeEach(async () => {
    const { user, team } = await seedUser();

    ({ token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test-envelope-copy-contents',
      expiresIn: null,
    }));
  });

  for (const route of COPY_ROUTES) {
    test(`${route.name} copies the contents onto the matching items`, async ({ request }) => {
      const sourceId = await createSourceEnvelope(request, token, route.sourceType);

      const copyId = await route.copy({ request, token, sourceId });

      const source = await getContentSummaries(sourceId);
      const copy = await getContentSummaries(copyId);

      expect(source).toHaveLength(3);

      // The same contents on the same files, showing the same image.
      expect(copy).toHaveLength(source.length);
      expect(copy).toEqual(expect.arrayContaining(source));
    });

    test(`${route.name} leaves the contents behind when asked to`, async ({ request }) => {
      const sourceId = await createSourceEnvelope(request, token, route.sourceType);

      const copyId = await route.copy({ request, token, sourceId, includeContents: false });

      expect(await prisma.envelopeContent.count({ where: { envelopeId: copyId } })).toBe(0);
      expect(await prisma.envelopeContent.count({ where: { envelopeId: sourceId } })).toBe(3);
    });
  }

  test('envelope/duplicate logs the copied document, fields and contents', async ({ request }) => {
    const sourceId = await createSourceEnvelope(request, token, EnvelopeType.DOCUMENT, { withSignerFields: true });

    const sourceAuditLogCount = await prisma.documentAuditLog.count({ where: { envelopeId: sourceId } });

    const copyId = await getCopyRoute('envelope/duplicate').copy({ request, token, sourceId });

    const copy = await prisma.envelope.findUniqueOrThrow({
      where: { id: copyId },
      include: { recipients: true, fields: true, contents: true },
    });

    const auditLogs = await prisma.documentAuditLog.findMany({ where: { envelopeId: copyId } });

    const logsOfType = (type: string) => auditLogs.filter((log) => log.type === type);

    // The copy's own creation is on record, with the copied title.
    expect(logsOfType('DOCUMENT_CREATED')).toHaveLength(1);
    expect(logsOfType('DOCUMENT_CREATED')[0].data).toMatchObject({ title: copy.title });

    // One entry per copied field, naming the copy's own field and recipient IDs.
    const [signer] = copy.recipients;

    expect(copy.fields).toHaveLength(2);

    expect(logsOfType('FIELD_CREATED').map((log) => log.data)).toEqual(
      expect.arrayContaining(
        copy.fields.map((field) => ({
          fieldId: field.secondaryId,
          fieldRecipientEmail: signer.email,
          fieldRecipientId: signer.id,
          fieldType: field.type,
        })),
      ),
    );

    expect(logsOfType('FIELD_CREATED')).toHaveLength(2);

    // One entry per copied content, naming the copy's own content and item IDs.
    expect(copy.contents).toHaveLength(3);

    expect(logsOfType('CONTENT_CREATED').map((log) => log.data)).toEqual(
      expect.arrayContaining(
        copy.contents.map((content) => ({
          contentId: content.id,
          contentType: content.contentMeta.type,
          envelopeItemId: content.envelopeItemId,
          contentMeta: content.contentMeta,
          dataContentId: content.dataContentId,
        })),
      ),
    );

    expect(logsOfType('CONTENT_CREATED')).toHaveLength(3);

    // Nothing was written against the source.
    expect(await prisma.documentAuditLog.count({ where: { envelopeId: sourceId } })).toBe(sourceAuditLogCount);
  });

  test('envelope/duplicate logs nothing for a template', async ({ request }) => {
    const sourceId = await createSourceEnvelope(request, token, EnvelopeType.TEMPLATE, { withSignerFields: true });

    const copyId = await getCopyRoute('envelope/duplicate').copy({ request, token, sourceId });

    const copy = await prisma.envelope.findUniqueOrThrow({
      where: { id: copyId },
      include: { fields: true, contents: true },
    });

    // The fields and contents are copied, but a template has no audit trail.
    expect(copy.type).toBe(EnvelopeType.TEMPLATE);
    expect(copy.fields).toHaveLength(2);
    expect(copy.contents).toHaveLength(3);
    expect(await prisma.documentAuditLog.count({ where: { envelopeId: copyId } })).toBe(0);
  });
});
