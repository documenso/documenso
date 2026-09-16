import crypto from 'node:crypto';
import { DOCUMENSO_ENCRYPTION_KEY } from '@documenso/lib/constants/crypto';
import { symmetricEncrypt } from '@documenso/lib/universal/crypto';
import { prisma } from '@documenso/prisma';
import { base32 } from '@scure/base';
import { generateHOTP } from 'oslo/otp';

/**
 * Must match the period used by `verifyTwoFactorAuthenticationToken` in
 * `packages/lib/server-only/2fa/verify-2fa-token.ts`.
 */
const TOTP_PERIOD_MS = 30_000;

/**
 * Enables 2FA for an existing user using the exact storage format the server
 * writes in `setup-2fa.ts`/`enable-2fa.ts` (base32 TOTP secret + JSON backup
 * codes, both symmetrically encrypted with the instance encryption key).
 *
 * No mocks: the server validates codes generated from this secret with the
 * same OTP library used here.
 */
export const seedUserTwoFactorAuthentication = async ({ userId }: { userId: number }) => {
  const key = DOCUMENSO_ENCRYPTION_KEY;

  if (!key) {
    throw new Error('NEXT_PRIVATE_ENCRYPTION_KEY must be set to seed 2FA users');
  }

  const secret = crypto.randomBytes(10);

  const backupCodes = Array.from({ length: 10 })
    .fill(null)
    .map(() => crypto.randomBytes(5).toString('hex'))
    .map((code) => `${code.slice(0, 5)}-${code.slice(5)}`.toUpperCase());

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: symmetricEncrypt({
        key,
        data: base32.encode(new Uint8Array(secret)),
      }),
      twoFactorBackupCodes: symmetricEncrypt({
        key,
        data: JSON.stringify(backupCodes),
      }),
    },
  });

  return {
    secret,
    backupCodes,
  };
};

/**
 * Computes the TOTP code for the current time window, mirroring the server's
 * verification (`generateHOTP` with a 30 second period).
 */
export const generateTotpCode = async ({ secret }: { secret: Buffer }) => {
  return await generateHOTP(new Uint8Array(secret), Math.floor(Date.now() / TOTP_PERIOD_MS));
};

/**
 * The server only accepts the code for the current 30s window (window = 1).
 * If we are close to a window boundary, wait for the next window so the code
 * cannot expire between generation and verification.
 */
export const waitForStableTotpWindow = async () => {
  const remainingMs = TOTP_PERIOD_MS - (Date.now() % TOTP_PERIOD_MS);

  if (remainingMs < 5_000) {
    await new Promise((resolve) => {
      setTimeout(resolve, remainingMs + 250);
    });
  }
};

type SeedOrganisationTwoFactorEnforcementOptions = {
  organisationId: string;
  twoFactorRequired?: boolean;
  twoFactorGracePeriodDays?: number;
};

/**
 * Directly seeds the organisation-level 2FA enforcement settings, bypassing
 * the tRPC settings write path (which is covered by its own tests).
 */
export const seedOrganisationTwoFactorEnforcement = async ({
  organisationId,
  twoFactorRequired = true,
  twoFactorGracePeriodDays = 0,
}: SeedOrganisationTwoFactorEnforcementOptions) => {
  await prisma.organisation.update({
    where: {
      id: organisationId,
    },
    data: {
      organisationGlobalSettings: {
        update: {
          twoFactorRequired,
          twoFactorGracePeriodDays,
          twoFactorEnforcedFrom: twoFactorRequired ? new Date() : null,
        },
      },
    },
  });
};
