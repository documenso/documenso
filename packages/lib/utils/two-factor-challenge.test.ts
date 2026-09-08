import { describe, expect, it } from 'vitest';

import { ZTwoFactorChallengeMetadataSchema } from '../types/two-factor-challenge';
import {
  isChallengeExpired,
  shouldConsumeChallengeAfterFailure,
  TWO_FACTOR_CHALLENGE_MAX_ATTEMPTS,
} from './two-factor-challenge';

describe('ZTwoFactorChallengeMetadataSchema', () => {
  it('parses minimal valid metadata and normalizes the redirect path', () => {
    const result = ZTwoFactorChallengeMetadataSchema.parse({
      redirectPath: '/documents?page=2',
      authMethod: 'oauth',
    });

    expect(result).toEqual({
      redirectPath: '/documents?page=2',
      authMethod: 'oauth',
    });
  });

  it('normalizes a same-origin absolute URL down to a path', () => {
    const result = ZTwoFactorChallengeMetadataSchema.parse({
      redirectPath: 'http://localhost:3000/settings/security',
      authMethod: 'oauth',
    });

    expect(result.redirectPath).toBe('/settings/security');
  });

  it('rejects cross-origin redirect paths', () => {
    const result = ZTwoFactorChallengeMetadataSchema.safeParse({
      redirectPath: 'https://evil.example.com/phish',
      authMethod: 'oauth',
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown authentication methods', () => {
    const result = ZTwoFactorChallengeMetadataSchema.safeParse({
      redirectPath: '/',
      authMethod: 'carrier-pigeon',
    });

    expect(result.success).toBe(false);
  });

  it('accepts a deferred link action', () => {
    const result = ZTwoFactorChallengeMetadataSchema.parse({
      redirectPath: '/',
      authMethod: 'oauth',
      action: {
        type: 'link-oauth-account',
        provider: 'google',
        providerAccountId: 'subject-123',
        email: 'user@example.com',
      },
    });

    expect(result.action?.provider).toBe('google');
  });

  it('rejects unknown keys on the metadata (strict)', () => {
    const result = ZTwoFactorChallengeMetadataSchema.safeParse({
      redirectPath: '/',
      authMethod: 'oauth',
      accessToken: 'must-never-be-stored',
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown keys on the action (strict)', () => {
    const result = ZTwoFactorChallengeMetadataSchema.safeParse({
      redirectPath: '/',
      authMethod: 'oauth',
      action: {
        type: 'link-oauth-account',
        provider: 'google',
        providerAccountId: 'subject-123',
        email: 'user@example.com',
        idToken: 'must-never-be-stored',
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an action with an invalid email', () => {
    const result = ZTwoFactorChallengeMetadataSchema.safeParse({
      redirectPath: '/',
      authMethod: 'oauth',
      action: {
        type: 'link-oauth-account',
        provider: 'google',
        providerAccountId: 'subject-123',
        email: 'not-an-email',
      },
    });

    expect(result.success).toBe(false);
  });
});

describe('shouldConsumeChallengeAfterFailure', () => {
  it('does not consume below the maximum attempts', () => {
    expect(shouldConsumeChallengeAfterFailure(TWO_FACTOR_CHALLENGE_MAX_ATTEMPTS - 1)).toBe(false);
    expect(shouldConsumeChallengeAfterFailure(1)).toBe(false);
  });

  it('consumes at exactly the maximum attempts', () => {
    expect(shouldConsumeChallengeAfterFailure(TWO_FACTOR_CHALLENGE_MAX_ATTEMPTS)).toBe(true);
  });

  it('consumes beyond the maximum attempts', () => {
    expect(shouldConsumeChallengeAfterFailure(TWO_FACTOR_CHALLENGE_MAX_ATTEMPTS + 5)).toBe(true);
  });

  it('honors a custom maximum', () => {
    expect(shouldConsumeChallengeAfterFailure(2, 3)).toBe(false);
    expect(shouldConsumeChallengeAfterFailure(3, 3)).toBe(true);
  });
});

describe('isChallengeExpired', () => {
  const expiresAt = new Date('2026-01-01T00:10:00.000Z');

  it('is not expired before the expiry instant', () => {
    expect(isChallengeExpired({ expiresAt, now: new Date('2026-01-01T00:09:59.999Z') })).toBe(false);
  });

  it('is expired at exactly the expiry instant', () => {
    expect(isChallengeExpired({ expiresAt, now: expiresAt })).toBe(true);
  });

  it('is expired after the expiry instant', () => {
    expect(isChallengeExpired({ expiresAt, now: new Date('2026-01-01T00:10:00.001Z') })).toBe(true);
  });
});
