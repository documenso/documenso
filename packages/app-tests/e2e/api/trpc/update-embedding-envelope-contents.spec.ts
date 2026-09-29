import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createDataContentImage } from '@documenso/lib/server-only/data-content/create-data-content-image';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import {
  EnvelopeContentType,
  type TEnvelopeContentMeta,
  ZEnvelopeContentMetaSchema,
} from '@documenso/lib/types/envelope-content-meta';
import { generateDatabaseId, nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import type { TUpdateEmbeddingEnvelopePayload } from '@documenso/trpc/server/embedding-router/update-embedding-envelope.types';
import { type APIRequestContext, expect, test } from '@playwright/test';
import type { Team } from '@prisma/client';

import { createGifLabelledAsPng, createImageFile, type TestImageFile } from '../../fixtures/contents';

/**
 * The embedded editor saves everything in one request when the envelope is
 * updated. New contents have temporary IDs, new images are referenced by their
 * index in `contentImages`, and the contents are checked before anything is
 * written, so a request which fails changes nothing.
 */

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({
  mode: 'parallel',
});

/**
 * Seed a draft document and a presign token scoped to it, as the embedded
 * editor is given.
 */
const setupEmbeddedDocument = async (request: APIRequestContext) => {
  const { user, team } = await seedUser();

  const document = await seedBlankDocument(user, team.id, { internalVersion: 2 });

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: document.id },
    include: { envelopeItems: true },
  });

  const { token: apiToken } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: 'e2e-embed-update-contents',
    expiresIn: null,
  });

  const presignRes = await request.post(`${WEBAPP_BASE_URL}/api/v2/embedding/create-presign-token`, {
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    data: { scope: `envelopeId:${envelope.id}` },
  });

  expect(presignRes.ok()).toBeTruthy();

  const { token: presignToken }: { token: string } = await presignRes.json();

  return { team, envelope, envelopeItem: envelope.envelopeItems[0], presignToken };
};

type UpdateEmbeddedEnvelopeOptions = {
  request: APIRequestContext;
  presignToken: string;
  envelope: { id: string; title: string };
  envelopeItem: { id: string; title: string; order: number };
  data: Partial<TUpdateEmbeddingEnvelopePayload['data']>;
  images?: TestImageFile[];
};

/**
 * Save the envelope through the embedded update route, as the embedded
 * editor does.
 */
const updateEmbeddedEnvelope = async ({
  request,
  presignToken,
  envelope,
  envelopeItem,
  data,
  images = [],
}: UpdateEmbeddedEnvelopeOptions) => {
  const payload: TUpdateEmbeddingEnvelopePayload = {
    envelopeId: envelope.id,
    data: {
      title: envelope.title,
      envelopeItems: [{ id: envelopeItem.id, title: envelopeItem.title, order: envelopeItem.order }],
      recipients: [],
      attachments: [],
      ...data,
    },
  };

  const formData = new FormData();

  formData.append('payload', JSON.stringify(payload));

  for (const image of images) {
    formData.append('contentImages', new File([image.buffer], image.name, { type: image.mimeType }));
  }

  return await request.post(`${WEBAPP_BASE_URL}/api/trpc/embeddingPresign.updateEmbeddingEnvelope`, {
    headers: { authorization: `Bearer ${presignToken}` },
    multipart: formData,
  });
};

const setOrganisationContentLimit = async (team: Team, envelopeContentCount: number) => {
  const organisationClaim = await prisma.organisationClaim.findFirstOrThrow({
    where: {
      organisation: {
        id: team.organisationId,
      },
    },
  });

  await prisma.organisationClaim.update({
    where: {
      id: organisationClaim.id,
    },
    data: {
      envelopeContentCount,
    },
  });
};

const countDataContentsNamed = async (fileName: string) =>
  await prisma.dataContent.count({
    where: {
      metadata: {
        path: ['fileName'],
        equals: fileName,
      },
    },
  });

/**
 * A failed update must leave the envelope as it was: the title is only
 * changed by the steps which run before the contents are set.
 */
const expectEnvelopeUnchanged = async (envelope: { id: string; title: string }) => {
  const current = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelope.id },
    include: { contents: true },
  });

  expect(current.title).toBe(envelope.title);
  expect(current.contents).toHaveLength(0);
};

const textMeta = (positionY = 10): TEnvelopeContentMeta =>
  ZEnvelopeContentMetaSchema.parse({
    type: EnvelopeContentType.TEXT,
    page: 1,
    positionX: 10,
    positionY,
    width: 40,
    height: 5,
    text: 'Text',
  });

const imageMeta = (positionY: number): TEnvelopeContentMeta =>
  ZEnvelopeContentMetaSchema.parse({
    type: EnvelopeContentType.IMAGE,
    page: 1,
    positionX: 10,
    positionY,
    width: 30,
    height: 10,
  });

test.describe('Update embedded envelope contents', () => {
  test('saves new contents and their new images', async ({ request }) => {
    const { envelope, envelopeItem, presignToken } = await setupEmbeddedDocument(request);
    const image = await createImageFile(`embed-update-${nanoid()}.png`, 300, 100);

    const res = await updateEmbeddedEnvelope({
      request,
      presignToken,
      envelope,
      envelopeItem,
      data: {
        contents: [
          {
            id: 'PRESIGNED_content-a',
            envelopeItemId: envelopeItem.id,
            contentMeta: imageMeta(10),
            dataContentId: null,
            imageIndex: 0,
          },
          // A duplicate showing the same image.
          {
            id: 'PRESIGNED_content-b',
            envelopeItemId: envelopeItem.id,
            contentMeta: imageMeta(40),
            dataContentId: null,
            imageIndex: 0,
          },
          {
            id: 'PRESIGNED_content-c',
            envelopeItemId: envelopeItem.id,
            contentMeta: textMeta(),
            dataContentId: null,
          },
        ],
      },
      images: [image],
    });

    expect(res.ok(), await res.text()).toBeTruthy();

    const contents = await prisma.envelopeContent.findMany({
      where: { envelopeId: envelope.id },
      include: { dataContent: true },
    });

    expect(contents).toHaveLength(3);
    expect(contents.some((content) => content.id.startsWith('PRESIGNED_'))).toBe(false);

    const imageContents = contents.filter((content) => content.contentMeta.type === EnvelopeContentType.IMAGE);

    expect(imageContents).toHaveLength(2);

    // The image was stored once and is shared by both contents.
    expect(imageContents[0].dataContentId).not.toBeNull();
    expect(imageContents[0].dataContentId).toBe(imageContents[1].dataContentId);

    expect(imageContents[0].dataContent?.metadata).toMatchObject({
      width: 300,
      height: 100,
      fileName: image.name,
    });
  });

  test('rejects contents over the limit without changing anything', async ({ request }) => {
    const { team, envelope, envelopeItem, presignToken } = await setupEmbeddedDocument(request);
    const image = await createImageFile(`embed-limit-${nanoid()}.png`, 50, 50);

    await setOrganisationContentLimit(team, 1);

    const res = await updateEmbeddedEnvelope({
      request,
      presignToken,
      envelope,
      envelopeItem,
      data: {
        title: 'Changed title',
        contents: [
          {
            id: 'PRESIGNED_content-a',
            envelopeItemId: envelopeItem.id,
            contentMeta: imageMeta(10),
            dataContentId: null,
            imageIndex: 0,
          },
          {
            id: 'PRESIGNED_content-b',
            envelopeItemId: envelopeItem.id,
            contentMeta: textMeta(),
            dataContentId: null,
          },
        ],
      },
      images: [image],
    });

    expect(res.status()).toBe(400);
    expect(await res.text()).toContain('ENVELOPE_CONTENT_LIMIT_EXCEEDED');

    await expectEnvelopeUnchanged(envelope);
    expect(await countDataContentsNamed(image.name)).toBe(0);
  });

  test('rejects an unknown content id without changing anything', async ({ request }) => {
    const { envelope, envelopeItem, presignToken } = await setupEmbeddedDocument(request);

    const res = await updateEmbeddedEnvelope({
      request,
      presignToken,
      envelope,
      envelopeItem,
      data: {
        title: 'Changed title',
        contents: [
          {
            id: 'envelope_content_unknown',
            envelopeItemId: envelopeItem.id,
            contentMeta: textMeta(),
            dataContentId: null,
          },
        ],
      },
    });

    expect(res.status()).toBe(404);
    expect(await res.text()).toContain('Envelope content not found');

    await expectEnvelopeUnchanged(envelope);
  });

  test('rejects an image which is not attached to the envelope', async ({ request }) => {
    const { envelope, envelopeItem, presignToken } = await setupEmbeddedDocument(request);

    // An image stored for something else, referenced by its ID.
    const png = await createImageFile(`embed-foreign-${nanoid()}.png`, 50, 50);

    const foreignDataContent = await createDataContentImage({
      file: {
        name: png.name,
        arrayBuffer: async () => await new Blob([png.buffer]).arrayBuffer(),
      },
    });

    const res = await updateEmbeddedEnvelope({
      request,
      presignToken,
      envelope,
      envelopeItem,
      data: {
        title: 'Changed title',
        contents: [
          {
            id: 'PRESIGNED_content-a',
            envelopeItemId: envelopeItem.id,
            contentMeta: imageMeta(10),
            dataContentId: foreignDataContent.id,
          },
        ],
      },
    });

    expect(res.status()).toBe(404);
    expect(await res.text()).toContain(`Data content ${foreignDataContent.id} not found`);

    await expectEnvelopeUnchanged(envelope);
  });

  test('rejects an image index without an uploaded image', async ({ request }) => {
    const { envelope, envelopeItem, presignToken } = await setupEmbeddedDocument(request);

    const res = await updateEmbeddedEnvelope({
      request,
      presignToken,
      envelope,
      envelopeItem,
      data: {
        title: 'Changed title',
        contents: [
          {
            id: 'PRESIGNED_content-a',
            envelopeItemId: envelopeItem.id,
            contentMeta: imageMeta(10),
            dataContentId: null,
            imageIndex: 0,
          },
        ],
      },
    });

    expect(res.status()).toBe(400);
    expect(await res.text()).toContain('Invalid content image index');

    await expectEnvelopeUnchanged(envelope);
  });

  test('rejects a content listed twice without changing anything', async ({ request }) => {
    const { envelope, envelopeItem, presignToken } = await setupEmbeddedDocument(request);

    const existingContent = await prisma.envelopeContent.create({
      data: {
        id: generateDatabaseId('envelope_content'),
        envelopeId: envelope.id,
        envelopeItemId: envelopeItem.id,
        contentMeta: textMeta(),
      },
    });

    // Both entries would update the same content.
    const res = await updateEmbeddedEnvelope({
      request,
      presignToken,
      envelope,
      envelopeItem,
      data: {
        title: 'Changed title',
        contents: [
          {
            id: existingContent.id,
            envelopeItemId: envelopeItem.id,
            contentMeta: textMeta(30),
            dataContentId: null,
          },
          {
            id: existingContent.id,
            envelopeItemId: envelopeItem.id,
            contentMeta: textMeta(60),
            dataContentId: null,
          },
        ],
      },
    });

    expect(res.status()).toBe(400);
    expect(await res.text()).toContain('Content IDs must be unique');

    const current = await prisma.envelope.findUniqueOrThrow({
      where: { id: envelope.id },
      include: { contents: true },
    });

    expect(current.title).toBe(envelope.title);
    expect(current.contents).toHaveLength(1);
    expect(current.contents[0].contentMeta).toEqual(existingContent.contentMeta);
  });

  test('rejects a new content listed twice without changing anything', async ({ request }) => {
    const { envelope, envelopeItem, presignToken } = await setupEmbeddedDocument(request);

    const res = await updateEmbeddedEnvelope({
      request,
      presignToken,
      envelope,
      envelopeItem,
      data: {
        title: 'Changed title',
        contents: [
          {
            id: 'PRESIGNED_content-a',
            envelopeItemId: envelopeItem.id,
            contentMeta: textMeta(),
            dataContentId: null,
          },
          {
            id: 'PRESIGNED_content-a',
            envelopeItemId: envelopeItem.id,
            contentMeta: imageMeta(40),
            dataContentId: null,
          },
        ],
      },
    });

    expect(res.status()).toBe(400);
    expect(await res.text()).toContain('Content IDs must be unique');

    await expectEnvelopeUnchanged(envelope);
  });

  test('rejects an image which is not really a PNG, JPEG or WebP', async ({ request }) => {
    const { envelope, envelopeItem, presignToken } = await setupEmbeddedDocument(request);
    const image = createGifLabelledAsPng(`embed-format-${nanoid()}.png`);

    const res = await updateEmbeddedEnvelope({
      request,
      presignToken,
      envelope,
      envelopeItem,
      data: {
        title: 'Changed title',
        contents: [
          {
            id: 'PRESIGNED_content-a',
            envelopeItemId: envelopeItem.id,
            contentMeta: imageMeta(10),
            dataContentId: null,
            imageIndex: 0,
          },
        ],
      },
      images: [image],
    });

    expect(res.status()).toBe(400);
    expect(await res.text()).toContain('Unsupported image format: gif');

    await expectEnvelopeUnchanged(envelope);
    expect(await countDataContentsNamed(image.name)).toBe(0);
  });
});
