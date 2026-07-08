// ABOUTME: Unit tests for the password-signup gating helper covering the blanket
// ABOUTME: disable-signup flag and the password-signup-specific flag.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnv = vi.fn();

vi.mock('../utils/env', () => ({
  env: mockEnv,
}));

describe('isPasswordSignupDisabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns false when neither flag is set', async () => {
    mockEnv.mockReturnValue(undefined);

    const { isPasswordSignupDisabled } = await import('./auth');

    expect(isPasswordSignupDisabled()).toBe(false);
  });

  it('returns true when NEXT_PUBLIC_DISABLE_SIGNUP is true', async () => {
    mockEnv.mockImplementation((key: string) =>
      key === 'NEXT_PUBLIC_DISABLE_SIGNUP' ? 'true' : undefined,
    );

    const { isPasswordSignupDisabled } = await import('./auth');

    expect(isPasswordSignupDisabled()).toBe(true);
  });

  it('returns true when NEXT_PUBLIC_DISABLE_PASSWORD_SIGNUP is true', async () => {
    mockEnv.mockImplementation((key: string) =>
      key === 'NEXT_PUBLIC_DISABLE_PASSWORD_SIGNUP' ? 'true' : undefined,
    );

    const { isPasswordSignupDisabled } = await import('./auth');

    expect(isPasswordSignupDisabled()).toBe(true);
  });

  it('returns false when both flags are explicitly false', async () => {
    mockEnv.mockReturnValue('false');

    const { isPasswordSignupDisabled } = await import('./auth');

    expect(isPasswordSignupDisabled()).toBe(false);
  });
});
