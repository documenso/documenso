import fs from 'node:fs';
import path from 'node:path';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import {
  EnvelopeContentShapeType,
  EnvelopeContentType,
  type TEnvelopeContentMetaInput,
} from '@documenso/lib/types/envelope-content-meta';
import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/create-envelope.types';
import type { TGetEnvelopeResponse } from '@documenso/trpc/server/envelope-router/get-envelope.types';
import { type APIRequestContext, expect, test } from '@playwright/test';
import { EnvelopeType, FieldType, RecipientRole, type Team } from '@prisma/client';

import { createGifLabelledAsPng, createImageFile, type TestImageFile } from '../../fixtures/contents';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

test.describe.configure({
  mode: 'parallel',
});

const examplePdfBuffer = fs.readFileSync(path.join(__dirname, '../../../../../assets/example.pdf'));

type TCreateContentInput = {
  identifier?: string | number;
  contentMeta: TEnvelopeContentMetaInput;
  imageIndex?: number;
};

type CreateEnvelopeWithContentsOptions = {
  request: APIRequestContext;
  token: string;
  payload?: Partial<Omit<TCreateEnvelopePayload, 'contents'>>;
  contents: TCreateContentInput[];
  pdfNames?: string[];
  images?: TestImageFile[];
};

/**
 * Create an envelope with contents through the public create route.
 */
const createEnvelopeWithContents = async ({
  request,
  token,
  payload = {},
  contents,
  pdfNames = ['example.pdf'],
  images = [],
}: CreateEnvelopeWithContentsOptions) => {
  const formData = new FormData();

  formData.append(
    'payload',
    JSON.stringify({
      type: EnvelopeType.DOCUMENT,
      title: 'Envelope With Contents',
      ...payload,
      contents,
    }),
  );

  for (const pdfName of pdfNames) {
    formData.append('files', new File([examplePdfBuffer], pdfName, { type: 'application/pdf' }));
  }

  for (const image of images) {
    formData.append('contentImages', new File([image.buffer], image.name, { type: image.mimeType }));
  }

  return await request.post(`${baseUrl}/envelope/create`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: formData,
  });
};

const getEnvelope = async (request: APIRequestContext, token: string, envelopeId: string) => {
  const res = await request.get(`${baseUrl}/envelope/${envelopeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.ok()).toBeTruthy();

  return (await res.json()) as TGetEnvelopeResponse;
};

/**
 * Set the image content allowance on the organisation that owns the team.
 */
const setOrganisationContentImageLimit = async (team: Team, envelopeContentImageCount: number) => {
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
      envelopeContentImageCount,
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

const textMeta = (text: string): TEnvelopeContentMetaInput => ({
  type: EnvelopeContentType.TEXT,
  page: 1,
  positionX: 10,
  positionY: 10,
  width: 40,
  height: 5,
  text,
});

const RECTANGLE_META: TEnvelopeContentMetaInput = {
  type: EnvelopeContentType.SHAPE,
  shape: EnvelopeContentShapeType.RECTANGLE,
  page: 1,
  positionX: 10,
  positionY: 20,
  width: 20,
  height: 10,
};

const imageMeta = (positionY: number): TEnvelopeContentMetaInput => ({
  type: EnvelopeContentType.IMAGE,
  page: 1,
  positionX: 10,
  positionY,
  width: 30,
  height: 10,
});

test.describe('Create envelope with contents', () => {
  let team: Team;
  let token: string;

  test.beforeEach(async () => {
    const seeded = await seedUser();

    team = seeded.team;

    ({ token } = await createApiToken({
      userId: seeded.user.id,
      teamId: team.id,
      tokenName: 'test-envelope-create-contents',
      expiresIn: null,
    }));
  });

  for (const envelopeType of [EnvelopeType.DOCUMENT, EnvelopeType.TEMPLATE]) {
    test(`creates a ${envelopeType.toLowerCase()} with contents and images`, async ({ request }) => {
      const logo = await createImageFile(`logo-${nanoid()}.png`, 300, 100);

      const res = await createEnvelopeWithContents({
        request,
        token,
        payload: { type: envelopeType },
        contents: [
          { contentMeta: textMeta('Hello') },
          { contentMeta: RECTANGLE_META },
          { contentMeta: imageMeta(40), imageIndex: 0 },
          // A second content showing the same image.
          { contentMeta: imageMeta(60), imageIndex: 0 },
          // An image content which has no image yet.
          { contentMeta: imageMeta(80) },
        ],
        images: [logo],
      });

      expect(res.ok(), await res.text()).toBeTruthy();

      const { id } = (await res.json()) as TCreateEnvelopeResponse;

      // Contents are returned by the public get route.
      const envelope = await getEnvelope(request, token, id);
      const [envelopeItem] = envelope.envelopeItems;

      expect(envelope.contents).toHaveLength(5);
      expect(envelope.contents.every((content) => content.envelopeItemId === envelopeItem.id)).toBe(true);

      const text = envelope.contents.find((content) => content.contentMeta.type === EnvelopeContentType.TEXT);
      const shape = envelope.contents.find((content) => content.contentMeta.type === EnvelopeContentType.SHAPE);

      expect(text?.contentMeta).toMatchObject({ text: 'Hello', page: 1, positionX: 10, positionY: 10 });
      expect(shape?.contentMeta).toMatchObject({ shape: EnvelopeContentShapeType.RECTANGLE });

      const images = envelope.contents.filter((content) => content.contentMeta.type === EnvelopeContentType.IMAGE);
      const withImage = images.filter((content) => content.dataContentId !== null);

      expect(images).toHaveLength(3);
      expect(withImage).toHaveLength(2);

      // The image is stored once and shared by both contents showing it.
      expect(withImage[0].dataContentId).toBe(withImage[1].dataContentId);

      const dataContent = await prisma.dataContent.findUniqueOrThrow({
        where: { id: withImage[0].dataContentId ?? '' },
      });

      expect(dataContent.metadata).toMatchObject({
        type: 'image',
        width: 300,
        height: 100,
        mimeType: 'image/png',
        fileName: logo.name,
      });
    });
  }

  test('places each content on the file it identifies', async ({ request }) => {
    const res = await createEnvelopeWithContents({
      request,
      token,
      pdfNames: ['first.pdf', 'second.pdf'],
      contents: [
        { contentMeta: textMeta('Default') },
        { identifier: 'second.pdf', contentMeta: textMeta('By name') },
        { identifier: 1, contentMeta: textMeta('By index') },
      ],
    });

    expect(res.ok(), await res.text()).toBeTruthy();

    const { id } = (await res.json()) as TCreateEnvelopeResponse;

    const envelope = await getEnvelope(request, token, id);
    const [first, second] = [...envelope.envelopeItems].sort((a, b) => a.order - b.order);

    const envelopeItemIdByText = Object.fromEntries(
      envelope.contents.map((content) => [
        content.contentMeta.type === EnvelopeContentType.TEXT ? content.contentMeta.text : content.id,
        content.envelopeItemId,
      ]),
    );

    expect(envelopeItemIdByText).toEqual({
      Default: first.id,
      'By name': second.id,
      'By index': second.id,
    });
  });

  test('rejects contents over the limits without storing their images', async ({ request }) => {
    await setOrganisationContentImageLimit(team, 1);

    const externalId = `e2e-contents-limit-${nanoid()}`;

    const images = await Promise.all([
      createImageFile(`limit-a-${nanoid()}.png`, 50, 50),
      createImageFile(`limit-b-${nanoid()}.png`, 50, 50),
    ]);

    const res = await createEnvelopeWithContents({
      request,
      token,
      payload: { externalId },
      contents: [
        { contentMeta: imageMeta(40), imageIndex: 0 },
        { contentMeta: imageMeta(60), imageIndex: 1 },
      ],
      images,
    });

    expect(res.status()).toBe(400);
    expect(await res.text()).toContain('ENVELOPE_CONTENT_IMAGE_LIMIT_EXCEEDED');

    expect(await prisma.envelope.count({ where: { externalId } })).toBe(0);

    for (const image of images) {
      expect(await countDataContentsNamed(image.name)).toBe(0);
    }
  });

  test('rejects a content on a page its file does not have', async ({ request }) => {
    const externalId = `e2e-contents-page-${nanoid()}`;
    const image = await createImageFile(`page-${nanoid()}.png`, 50, 50);

    // The example PDF has a single page.
    const res = await createEnvelopeWithContents({
      request,
      token,
      payload: { externalId },
      contents: [{ contentMeta: { ...imageMeta(40), page: 2 }, imageIndex: 0 }],
      images: [image],
    });

    expect(res.status()).toBe(400);
    expect(await res.text()).toContain('only has 1 page(s)');

    expect(await prisma.envelope.count({ where: { externalId } })).toBe(0);

    // Rejected before the image was stored.
    expect(await countDataContentsNamed(image.name)).toBe(0);
  });

  test('rejects an image index without an image', async ({ request }) => {
    const externalId = `e2e-contents-index-${nanoid()}`;

    const res = await createEnvelopeWithContents({
      request,
      token,
      payload: { externalId },
      contents: [{ contentMeta: imageMeta(40), imageIndex: 1 }],
      images: [await createImageFile(`index-${nanoid()}.png`, 50, 50)],
    });

    expect(res.status()).toBe(400);
    expect(await res.text()).toContain('Invalid content image index');

    expect(await prisma.envelope.count({ where: { externalId } })).toBe(0);
  });

  test('rejects an image on a content which cannot hold one', async ({ request }) => {
    const externalId = `e2e-contents-type-${nanoid()}`;
    const image = await createImageFile(`type-${nanoid()}.png`, 50, 50);

    const res = await createEnvelopeWithContents({
      request,
      token,
      payload: { externalId },
      contents: [{ contentMeta: textMeta('Not an image'), imageIndex: 0 }],
      images: [image],
    });

    expect(res.status()).toBe(400);
    expect(await res.text()).toContain('A text content cannot hold an image');

    expect(await prisma.envelope.count({ where: { externalId } })).toBe(0);
    expect(await countDataContentsNamed(image.name)).toBe(0);
  });

  for (const { identifier, description } of [
    { identifier: 'missing.pdf', description: 'a file name' },
    { identifier: 1, description: 'a file index' },
  ]) {
    test(`rejects a content on ${description} which was not uploaded`, async ({ request }) => {
      const externalId = `e2e-contents-identifier-${nanoid()}`;
      const image = await createImageFile(`identifier-${nanoid()}.png`, 50, 50);

      // Only "example.pdf" is uploaded, at index 0.
      const res = await createEnvelopeWithContents({
        request,
        token,
        payload: { externalId },
        contents: [{ identifier, contentMeta: imageMeta(40), imageIndex: 0 }],
        images: [image],
      });

      expect(res.status()).toBe(404);
      expect(await res.text()).toContain('Document data not found');

      expect(await prisma.envelope.count({ where: { externalId } })).toBe(0);

      // Rejected before the image was stored.
      expect(await countDataContentsNamed(image.name)).toBe(0);
    });
  }

  // A file is picked by its position counted from 0, so any other number is
  // refused rather than read as some other file (-1 used to mean the last).
  for (const { identifier, description } of [
    { identifier: -1, description: 'a negative file index' },
    { identifier: 0.5, description: 'a fractional file index' },
  ]) {
    test(`rejects a content on ${description}`, async ({ request }) => {
      const externalId = `e2e-contents-bad-index-${nanoid()}`;

      const res = await createEnvelopeWithContents({
        request,
        token,
        payload: { externalId },
        contents: [{ identifier, contentMeta: textMeta('Bad index') }],
      });

      expect(res.status()).toBe(400);
      expect(await prisma.envelope.count({ where: { externalId } })).toBe(0);
    });

    test(`rejects a field on ${description}`, async ({ request }) => {
      const externalId = `e2e-fields-bad-index-${nanoid()}`;

      const res = await createEnvelopeWithContents({
        request,
        token,
        payload: {
          externalId,
          recipients: [
            {
              email: `signer-${nanoid()}@test.documenso.com`,
              name: 'Signer',
              role: RecipientRole.SIGNER,
              fields: [
                {
                  type: FieldType.SIGNATURE,
                  identifier,
                  page: 1,
                  positionX: 10,
                  positionY: 10,
                  width: 10,
                  height: 5,
                  fieldMeta: { type: 'signature', overflow: 'crop' },
                },
              ],
            },
          ],
        },
        contents: [],
      });

      expect(res.status()).toBe(400);
      expect(await prisma.envelope.count({ where: { externalId } })).toBe(0);
    });
  }

  test('rejects an image which is not really a PNG, JPEG or WebP', async ({ request }) => {
    const externalId = `e2e-contents-format-${nanoid()}`;
    const image = createGifLabelledAsPng(`format-${nanoid()}.png`);

    const res = await createEnvelopeWithContents({
      request,
      token,
      payload: { externalId },
      contents: [{ contentMeta: imageMeta(40), imageIndex: 0 }],
      images: [image],
    });

    expect(res.status()).toBe(400);
    expect(await res.text()).toContain('Unsupported image format: gif');

    expect(await prisma.envelope.count({ where: { externalId } })).toBe(0);
    expect(await countDataContentsNamed(image.name)).toBe(0);
  });

  test('documents contents on the public create route', async ({ request }) => {
    const res = await request.get(`${WEBAPP_BASE_URL}/api/v2/openapi.json`);

    expect(res.ok()).toBeTruthy();

    const openApiDocument: unknown = await res.json();

    const requestSchemaPath = [
      'paths',
      '/envelope/create',
      'post',
      'requestBody',
      'content',
      'multipart/form-data',
      'schema',
      'properties',
    ];

    expect(openApiDocument).toHaveProperty([...requestSchemaPath, 'contentImages']);

    expect(openApiDocument).toHaveProperty([
      ...requestSchemaPath,
      'payload',
      'properties',
      'contents',
      'items',
      'properties',
      'imageIndex',
    ]);
  });
});
