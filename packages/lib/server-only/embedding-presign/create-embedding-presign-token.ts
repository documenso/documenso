import { SignJWT } from 'jose';
import { DateTime } from 'luxon';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { env } from '../../utils/env';
import { getApiTokenByToken } from '../public-api/get-api-token-by-token';

export type CreateEmbeddingPresignTokenOptions = {
  apiToken: string;
  /**
   * Number of hours until the token expires
   * In development mode, can be set to 0 to create a token that expires immediately (for testing)
   */
  expiresIn?: number;
};

export const createEmbeddingPresignToken = async ({
  apiToken,
  expiresIn,
}: CreateEmbeddingPresignTokenOptions) => {
  try {
    // Validate the API token
    const validatedToken = await getApiTokenByToken({ token: apiToken });

    const now = DateTime.now();

    // In development mode, allow setting expiresIn to 0 for testing
    // In production, enforce a minimum expiration time
    const isDevelopment = env('NODE_ENV') !== 'production';
    console.log('isDevelopment', isDevelopment);
    const minExpirationMinutes = isDevelopment ? 0 : 5;

    // Ensure expiresIn is at least the minimum allowed value
    const effectiveExpiresIn =
      expiresIn !== undefined && expiresIn >= minExpirationMinutes ? expiresIn : 60; // Default to 1 hour if not specified or below minimum

    const expiresAt = now.plus({ minutes: effectiveExpiresIn });

    const secret = new TextEncoder().encode(validatedToken.token);

    const token = await new SignJWT({
      aud: String(validatedToken.teamId ?? validatedToken.userId),
      sub: String(validatedToken.id),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now.toJSDate())
      .setExpirationTime(expiresAt.toJSDate())
      .sign(secret);

    return {
      token,
      expiresAt: expiresAt.toJSDate(),
      expiresIn: Math.floor(expiresAt.diff(now).toMillis() / 1000),
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Failed to create presign token',
    });
  }
};
