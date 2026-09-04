import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { SignupInviteStatus } from '@prisma/client';
import { nanoid } from 'nanoid';
import { describe, expect, it } from 'vitest';
import { AppErrorCode } from '../../errors/app-error';
import { validateSignupInvite } from './validate-signup-invite';

describe('validate-signup-invite', () => {
  it('should validate a pending invite for the matching email', async () => {
    const email = `validate-invite-${Date.now()}@example.com`;
    const token = nanoid();

    await prisma.signupInvite.create({
      data: {
        id: generateDatabaseId('signup_invite'),
        email,
        token,
        expiresAt: new Date(Date.now() + 86_400_000),
        status: SignupInviteStatus.PENDING,
      },
    });

    const invite = await validateSignupInvite({
      token,
      email,
    });

    expect(invite.email).toBe(email);
  });

  it('should reject invites with a mismatched email', async () => {
    const token = nanoid();

    await prisma.signupInvite.create({
      data: {
        id: generateDatabaseId('signup_invite'),
        email: `owner-${Date.now()}@example.com`,
        token,
        expiresAt: new Date(Date.now() + 86_400_000),
        status: SignupInviteStatus.PENDING,
      },
    });

    await expect(
      validateSignupInvite({
        token,
        email: 'other@example.com',
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.SIGNUP_INVITE_INVALID,
    });
  });
});
