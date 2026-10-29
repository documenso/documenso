import crypto from 'node:crypto';
import { DOCUMENSO_ENCRYPTION_KEY } from '@documenso/lib/constants/crypto';
import { symmetricEncrypt } from '@documenso/lib/universal/crypto';
import { prisma } from '@documenso/prisma';
import { base32 } from '@scure/base';
import { generateHOTP } from 'oslo/otp';

// Must match the period used by `verifyTwoFactorAuthenticationToken`.
const TOTP_PERIOD_MS = 30_000;

/**
 * Mirrors the storage format written by `setup-2fa.ts`/`enable-2fa.ts`.
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

export const generateTotpCode = async ({ secret }: { secret: Buffer }) => {
  return await generateHOTP(new Uint8Array(secret), Math.floor(Date.now() / TOTP_PERIOD_MS));
};

/**
 * Wait for the next window when close to a boundary so the code cannot expire
 * between generation and verification.
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
