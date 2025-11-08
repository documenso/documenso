import { expect, test } from '@playwright/test';
import type { APIRequestContext } from 'playwright-core';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import type { CreateEmbeddingPresignTokenOptions } from '@documenso/lib/server-only/embedding-presign/create-embedding-presign-token';
import type { VerifyEmbeddingPresignTokenOptions } from '@documenso/lib/server-only/embedding-presign/verify-embedding-presign-token';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { seedUser } from '@documenso/prisma/seed/users';

test.describe('Embedding Presign API', () => {
  test('createEmbeddingPresignToken: should create a token with default expiration', async ({
    request,
  }) => {
    const { user, team } = await seedUser();

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await createPresignToken(request, token);

    const responseData = await response.json();

    console.log(responseData);

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    expect(responseData.token).toBeDefined();
    expect(responseData.expiresAt).toBeDefined();
    expect(responseData.expiresIn).toBe(3600); // Default 1 hour in seconds
  });

  test('createEmbeddingPresignToken: should create a token with custom expiration', async ({
    request,
  }) => {
    const { user, team } = await seedUser();

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await createPresignToken(request, token, {
      expiresIn: 120, // 2 hours
    });

    const responseData = await response.json();

    console.log(responseData);

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    expect(responseData.token).toBeDefined();
    expect(responseData.expiresAt).toBeDefined();
    expect(responseData.expiresIn).toBe(7200); // 2 hours in seconds
  });

  test.skip('createEmbeddingPresignToken: should create a token with immediate expiration in dev mode', async ({
    request,
  }) => {
    const { user, team } = await seedUser();

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await createPresignToken(request, token, {
      expiresIn: 0, // Immediate expiration
    });

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const responseData = await response.json();

    console.log(responseData);

    expect(responseData.token).toBeDefined();
    expect(responseData.expiresAt).toBeDefined();
    expect(responseData.expiresIn).toBe(0); // 0 seconds
  });

  test('verifyEmbeddingPresignToken: should verify a valid token', async ({ request }) => {
    const { user, team } = await seedUser();

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    // First create a token
    const createResponse = await createPresignToken(request, token);

    expect(createResponse.ok()).toBeTruthy();
    const createResponseData = await createResponse.json();

    console.log('Create response:', createResponseData);

    const presignToken = createResponseData.token;

    // Then verify it
    const verifyResponse = await verifyPresignToken(request, token, {
      token: presignToken,
    });

    expect(verifyResponse.ok()).toBeTruthy();
    expect(verifyResponse.status()).toBe(200);

    const verifyResponseData = await verifyResponse.json();

    console.log('Verify response:', verifyResponseData);

    expect(verifyResponseData.success).toBe(true);
  });

  test('verifyEmbeddingPresignToken: should reject an invalid token', async ({ request }) => {
    const { user, team } = await seedUser();

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await verifyPresignToken(request, token, {
      token: 'invalid-token',
    });

    const responseData = await response.json();

    console.log('Invalid token response:', responseData);

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    expect(responseData.success).toBe(false);
  });

  test('verifyEmbeddingPresignToken: should verify a valid scoped token', async ({ request }) => {
    const { user, team } = await seedUser();

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    // First create a token
    const createResponse = await createPresignToken(request, token, {
      scope: 'documentId:1',
    });

    expect(createResponse.ok()).toBeTruthy();
    const createResponseData = await createResponse.json();

    console.log('Create response:', createResponseData);

    const presignToken = createResponseData.token;

    // Then verify it
    const verifyResponse = await verifyPresignToken(request, token, {
      token: presignToken,
      scope: 'documentId:1',
    });

    expect(verifyResponse.ok()).toBeTruthy();
    expect(verifyResponse.status()).toBe(200);

    const verifyResponseData = await verifyResponse.json();

    console.log('Verify response:', verifyResponseData);

    expect(verifyResponseData.success).toBe(true);
  });

  test('verifyEmbeddingPresignToken: should reject a scope mismatched token', async ({
    request,
  }) => {
    const { user, team } = await seedUser();

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test',
      expiresIn: null,
    });

    // First create a token
    const createResponse = await createPresignToken(request, token, {
      scope: 'documentId:1',
    });

    expect(createResponse.ok()).toBeTruthy();
    const createResponseData = await createResponse.json();

    console.log('Create response:', createResponseData);

    const presignToken = createResponseData.token;

    // Then verify it
    const response = await verifyPresignToken(request, token, {
      token: presignToken,
      scope: 'documentId:2',
    });

    const responseData = await response.json();

    console.log('Invalid token response:', responseData);

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    expect(responseData.success).toBe(false);
  });
});

const createPresignToken = async (
  request: APIRequestContext,
  apiToken: string,
  data?: Partial<CreateEmbeddingPresignTokenOptions>,
) => {
  return await request.post(
    `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2-beta/embedding/create-presign-token`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        apiToken,
        ...data,
      },
    },
  );
};

const verifyPresignToken = async (
  request: APIRequestContext,
  apiToken: string,
  data: VerifyEmbeddingPresignTokenOptions,
) => {
  return await request.post(
    `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2-beta/embedding/verify-presign-token`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      data,
    },
  );
};
