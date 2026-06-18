import fs from 'node:fs';
import path from 'node:path';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createEmbeddingPresignToken } from '@documenso/lib/server-only/embedding-presign/create-embedding-presign-token';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

const examplePdf = fs.readFileSync(path.join(__dirname, '../../../../../../assets/example.pdf'));

test.describe.configure({
  mode: 'parallel',
});

const createPresignTokenForUser = async (userId: number, teamId: number) => {
  const { token: apiToken } = await createApiToken({
    userId,
    teamId,
    tokenName: 'file-upload-test',
    expiresIn: null,
  });

  const { token: presignToken } = await createEmbeddingPresignToken({ apiToken });

  return presignToken;
};

const buildPdfFormData = () => {
  const formData = new FormData();
  formData.append('file', new File([examplePdf], 'test.pdf', { type: 'application/pdf' }));

  return formData;
};

test.describe('File upload endpoint authorization', () => {
  test('rejects an unauthenticated upload-pdf request', async ({ request }) => {
    const res = await request.post(`${WEBAPP_BASE_URL}/api/files/upload-pdf`, {
      multipart: buildPdfFormData(),
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(401);
  });

  test('rejects an unauthenticated presigned-post-url request', async ({ request }) => {
    const res = await request.post(`${WEBAPP_BASE_URL}/api/files/presigned-post-url`, {
      headers: { 'Content-Type': 'application/json' },
      data: { fileName: 'test.pdf', contentType: 'application/pdf' },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(401);
  });

  test('rejects a presigned-post-url request with an invalid presign token', async ({ request }) => {
    const res = await request.post(`${WEBAPP_BASE_URL}/api/files/presigned-post-url`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer not-a-real-token',
      },
      data: { fileName: 'test.pdf', contentType: 'application/pdf' },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(401);
  });

  test('rejects a presigned-post-url request with a disallowed content type', async ({ request }) => {
    const { user, team } = await seedUser();
    const presignToken = await createPresignTokenForUser(user.id, team.id);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/files/presigned-post-url`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${presignToken}`,
      },
      data: { fileName: 'malware.exe', contentType: 'application/x-msdownload' },
    });

    // Authenticated, but the content type is not on the allow-list.
    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(400);
  });

  test('allows an upload-pdf request authorized by a valid presign token', async ({ request }) => {
    const { user, team } = await seedUser();
    const presignToken = await createPresignTokenForUser(user.id, team.id);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/files/upload-pdf`, {
      headers: { Authorization: `Bearer ${presignToken}` },
      multipart: buildPdfFormData(),
    });

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.id).toBeDefined();
  });
});
