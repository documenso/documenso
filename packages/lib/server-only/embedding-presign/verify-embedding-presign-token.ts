import type { JWTPayload } from 'jose';
import { decodeJwt, jwtVerify } from 'jose';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type VerifyEmbeddingPresignTokenOptions = {
  token: string;
};

export const verifyEmbeddingPresignToken = async ({
  token,
}: VerifyEmbeddingPresignTokenOptions) => {
  // First decode the JWT to get the claims without verification
  let decodedToken: JWTPayload;

  try {
    decodedToken = decodeJwt<JWTPayload>(token);
  } catch (error) {
    console.error('Error decoding JWT token:', error);
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid presign token format',
    });
  }

  // Validate the required claims
  if (!decodedToken.sub || typeof decodedToken.sub !== 'string') {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid presign token format: missing or invalid subject claim',
    });
  }

  if (!decodedToken.aud || typeof decodedToken.aud !== 'string') {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid presign token format: missing or invalid audience claim',
    });
  }

  // Convert string IDs to numbers
  const tokenId = Number(decodedToken.sub);
  const audienceId = Number(decodedToken.aud);

  if (Number.isNaN(tokenId) || !Number.isInteger(tokenId)) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid token ID format in subject claim',
    });
  }

  if (Number.isNaN(audienceId) || !Number.isInteger(audienceId)) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid user ID format in audience claim',
    });
  }

  // Get the API token to use as the verification secret
  const apiToken = await prisma.apiToken.findFirst({
    where: {
      id: tokenId,
    },
  });

  if (!apiToken) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid presign token: API token not found',
    });
  }

  // This should never happen but we need to narrow types
  if (!apiToken.userId) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid presign token: API token does not have a user attached',
    });
  }

  const userId = apiToken.userId;

  if (audienceId !== apiToken.teamId && audienceId !== apiToken.userId) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid presign token: API token does not match audience',
    });
  }

  // Now verify the token with the actual secret
  const secret = new TextEncoder().encode(apiToken.token);

  try {
    await jwtVerify(token, secret);
  } catch (error) {
    // Check if the token has expired
    if (error instanceof Error && error.name === 'JWTExpired') {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Presign token has expired',
      });
    }

    // Handle invalid signature
    if (error instanceof Error && error.name === 'JWSInvalid') {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Invalid presign token signature',
      });
    }

    // Log and rethrow other errors
    console.error('Error verifying JWT token:', error);
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Failed to verify presign token',
    });
  }

  return {
    ...apiToken,
    userId,
  };
};
