import fs from 'node:fs';
import path from 'node:path';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { DataContentType } from '@documenso/lib/types/data-content-meta';
import { EnvelopeContentType, ZEnvelopeContentMetaSchema } from '@documenso/lib/types/envelope-content-meta';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, EnvelopeType, FieldType, RecipientRole } from '@documenso/prisma/client';
import { seedUser } from '@documenso/prisma/seed/users';
import type {
  TCreateEnvelopePayload,
  TCreateEnvelopeResponse,
} from '@documenso/trpc/server/envelope-router/create-envelope.types';
import type { TDistributeEnvelopeRequest } from '@documenso/trpc/server/envelope-router/distribute-envelope.types';
import type { TGetEnvelopeResponse } from '@documenso/trpc/server/envelope-router/get-envelope.types';
import { type APIRequestContext, type APIResponse, expect, test } from '@playwright/test';
import type { Team, User } from '@prisma/client';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

test.describe.configure({
  mode: 'parallel',
});

const examplePdfBuffer = fs.readFileSync(path.join(__dirname, '../../../../../assets/example.pdf'));

/**
 * Set the content allowances on the organisation that owns the seeded team.
 *
 * A value of `0` means unlimited.
 */
const setOrganisationContentLimits = async (
  team: Team,
  limits: { envelopeContentCount?: number; envelopeContentImageCount?: number },
) => {
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
    data: limits,
  });
};

const createEnvelope = async (request: APIRequestContext, authToken: string) => {
  const payload: TCreateEnvelopePayload = {
    type: EnvelopeType.DOCUMENT,
    title: 'Envelope Content Limit Test',
  };

  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));
  formData.append('files', new File([examplePdfBuffer], 'example.pdf', { type: 'application/pdf' }));

  const res = await request.post(`${baseUrl}/envelope/create`, {
    headers: { Authorization: `Bearer ${authToken}` },
    multipart: formData,
  });

  expect(res.ok()).toBeTruthy();

  return (await res.json()) as TCreateEnvelopeResponse;
};

/**
 * Build a distributable envelope holding `contentCount` contents, of which
 * `imageCount` are image contents, then attempt to distribute it.
 *
 * Contents are inserted directly since they are not part of the public API.
 * Image contents are given an image so the send is not rejected for the
 * unrelated reason of an image content having no image.
 */
const buildAndDistributeEnvelopeWithContents = async ({
  request,
  authToken,
  contentCount,
  imageCount = 0,
}: {
  request: APIRequestContext;
  authToken: string;
  contentCount: number;
  imageCount?: number;
}): Promise<{ envelopeId: string; distributeRes: APIResponse }> => {
  const envelope = await createEnvelope(request, authToken);

  const envelopeRes = await request.get(`${baseUrl}/envelope/${envelope.id}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  expect(envelopeRes.ok()).toBeTruthy();

  const envelopeData = (await envelopeRes.json()) as TGetEnvelopeResponse;
  const envelopeItemId = envelopeData.envelopeItems[0].id;

  const recipientRes = await request.post(`${baseUrl}/envelope/recipient/create-many`, {
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    data: {
      envelopeId: envelope.id,
      data: [
        {
          email: `recipient-${Date.now()}-${Math.random().toString(36).slice(2)}@test.documenso.com`,
          name: 'Recipient',
          role: RecipientRole.SIGNER,
          accessAuth: [],
          actionAuth: [],
        },
      ],
    },
  });

  expect(recipientRes.ok()).toBeTruthy();

  const [recipient] = (await recipientRes.json()).data;

  const fieldsRes = await request.post(`${baseUrl}/envelope/field/create-many`, {
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    data: {
      envelopeId: envelope.id,
      data: [
        {
          recipientId: recipient.id,
          envelopeItemId,
          type: FieldType.SIGNATURE,
          page: 1,
          positionX: 10,
          positionY: 60,
          width: 30,
          height: 8,
        },
      ],
    },
  });

  expect(fieldsRes.ok()).toBeTruthy();

  const dataContentIds = await Promise.all(
    Array.from({ length: imageCount }).map(async () => {
      const dataContent = await prisma.dataContent.create({
        data: {
          id: generateDatabaseId('data'),
          type: 'BYTES_64',
          data: 'aW1hZ2U=',
          metadata: {
            type: DataContentType.IMAGE,
            width: 10,
            height: 10,
            mimeType: 'image/png',
            fileName: 'image.png',
            fileSize: 5,
          },
        },
      });

      return dataContent.id;
    }),
  );

  await prisma.envelopeContent.createMany({
    data: Array.from({ length: contentCount }).map((_, index) => {
      const isImage = index < imageCount;

      return {
        id: generateDatabaseId('envelope_content'),
        envelopeId: envelope.id,
        envelopeItemId,
        dataContentId: isImage ? dataContentIds[index] : null,
        contentMeta: ZEnvelopeContentMetaSchema.parse(
          isImage
            ? {
                type: EnvelopeContentType.IMAGE,
                page: 1,
                rotation: 0,
                zIndex: 0,
                positionX: 10,
                positionY: 10,
                width: 20,
                height: 10,
              }
            : {
                type: EnvelopeContentType.TEXT,
                page: 1,
                rotation: 0,
                zIndex: 0,
                positionX: 10,
                positionY: 10,
                width: 20,
                height: 6,
                text: `Content ${index}`,
              },
        ),
      };
    }),
  });

  const distributeRes = await request.post(`${baseUrl}/envelope/distribute`, {
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    data: {
      envelopeId: envelope.id,
    } satisfies TDistributeEnvelopeRequest,
  });

  return { envelopeId: envelope.id, distributeRes };
};

const expectEnvelopeStatus = async (envelopeId: string, status: DocumentStatus) => {
  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelopeId },
  });

  expect(envelope.status).toBe(status);
};

test.describe('Envelope content limits on distribute', () => {
  let user: User;
  let team: Team;
  let token: string;

  test.beforeEach(async () => {
    ({ user, team } = await seedUser());
    ({ token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test-envelope-content-limit',
      expiresIn: null,
    }));
  });

  test('allows distribution when the content count is at the limit', async ({ request }) => {
    await setOrganisationContentLimits(team, { envelopeContentCount: 3 });

    const { envelopeId, distributeRes } = await buildAndDistributeEnvelopeWithContents({
      request,
      authToken: token,
      contentCount: 3,
    });

    expect(distributeRes.status()).toBe(200);

    await expectEnvelopeStatus(envelopeId, DocumentStatus.PENDING);
  });

  test('denies distribution when the content count is over the limit', async ({ request }) => {
    await setOrganisationContentLimits(team, { envelopeContentCount: 3 });

    const { envelopeId, distributeRes } = await buildAndDistributeEnvelopeWithContents({
      request,
      authToken: token,
      contentCount: 4,
    });

    expect(distributeRes.status()).toBe(400);
    expect(await distributeRes.text()).toContain('ENVELOPE_CONTENT_LIMIT_EXCEEDED');

    await expectEnvelopeStatus(envelopeId, DocumentStatus.DRAFT);
  });

  test('denies distribution when the image content count is over the limit', async ({ request }) => {
    await setOrganisationContentLimits(team, { envelopeContentImageCount: 1 });

    const { envelopeId, distributeRes } = await buildAndDistributeEnvelopeWithContents({
      request,
      authToken: token,
      contentCount: 3,
      imageCount: 2,
    });

    expect(distributeRes.status()).toBe(400);
    expect(await distributeRes.text()).toContain('ENVELOPE_CONTENT_IMAGE_LIMIT_EXCEEDED');

    await expectEnvelopeStatus(envelopeId, DocumentStatus.DRAFT);
  });

  test('allows distribution when the limits are unlimited', async ({ request }) => {
    await setOrganisationContentLimits(team, { envelopeContentCount: 0, envelopeContentImageCount: 0 });

    const { envelopeId, distributeRes } = await buildAndDistributeEnvelopeWithContents({
      request,
      authToken: token,
      contentCount: 12,
      imageCount: 6,
    });

    expect(distributeRes.status()).toBe(200);

    await expectEnvelopeStatus(envelopeId, DocumentStatus.PENDING);
  });
});
