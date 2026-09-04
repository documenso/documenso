import { describe, expect, it } from 'vitest';

import {
  computeSignupInviteExpiresAt,
  getDefaultSignupInviteExpiryDays,
  resolveSignupInviteExpiryDays,
} from './get-default-signup-invite-expiry-days';

describe('get-default-signup-invite-expiry-days', () => {
  it('should default to 7 days when env is unset', () => {
    expect(getDefaultSignupInviteExpiryDays()).toBe(7);
  });

  it('should cap custom expiry days at 30', () => {
    expect(resolveSignupInviteExpiryDays(45)).toBe(30);
  });

  it('should enforce a minimum of 1 day', () => {
    expect(resolveSignupInviteExpiryDays(0)).toBe(1);
  });

  it('should compute expiry dates from day count', () => {
    const expiresAt = computeSignupInviteExpiresAt(7);
    const expected = new Date();

    expected.setDate(expected.getDate() + 7);

    expect(expiresAt.getDate()).toBe(expected.getDate());
  });
});
