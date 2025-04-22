import { expect, test } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { seedUser } from '@documenso/prisma/seed/users';

test.describe('Embedding Presign API', () => {
  test('createEmbeddingPresignToken: should create a token with default expiration', async ({
    request,
  }) => {
    const user = await seedUser();

    const { token } = await createApiToken({
      userId: user.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2-beta/embedding/create-presign-token`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          apiToken: token,
        },
      },
    );

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
    const user = await seedUser();

    const { token } = await createApiToken({
      userId: user.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2-beta/embedding/create-presign-token`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          apiToken: token,
          expiresIn: 120, // 2 hours
        },
      },
    );

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
    const user = await seedUser();

    const { token } = await createApiToken({
      userId: user.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2-beta/embedding/create-presign-token`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          apiToken: token,
          expiresIn: 0, // Immediate expiration
        },
      },
    );

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const responseData = await response.json();

    console.log(responseData);

    expect(responseData.token).toBeDefined();
    expect(responseData.expiresAt).toBeDefined();
    expect(responseData.expiresIn).toBe(0); // 0 seconds
  });

  test('verifyEmbeddingPresignToken: should verify a valid token', async ({ request }) => {
    const user = await seedUser();

    const { token } = await createApiToken({
      userId: user.id,
      tokenName: 'test',
      expiresIn: null,
    });

    // First create a token
    const createResponse = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2-beta/embedding/create-presign-token`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          apiToken: token,
        },
      },
    );

    expect(createResponse.ok()).toBeTruthy();
    const createResponseData = await createResponse.json();

    console.log('Create response:', createResponseData);

    const presignToken = createResponseData.token;

    // Then verify it
    const verifyResponse = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2-beta/embedding/verify-presign-token`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          token: presignToken,
        },
      },
    );

    expect(verifyResponse.ok()).toBeTruthy();
    expect(verifyResponse.status()).toBe(200);

    const verifyResponseData = await verifyResponse.json();

    console.log('Verify response:', verifyResponseData);

    expect(verifyResponseData.success).toBe(true);
  });

  test('verifyEmbeddingPresignToken: should reject an invalid token', async ({ request }) => {
    const user = await seedUser();

    const { token } = await createApiToken({
      userId: user.id,
      tokenName: 'test',
      expiresIn: null,
    });

    const response = await request.post(
      `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2-beta/embedding/verify-presign-token`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          token: 'invalid-token',
        },
      },
    );

    const responseData = await response.json();

    console.log('Invalid token response:', responseData);

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    expect(responseData.success).toBe(false);
  });
});
