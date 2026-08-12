import { prisma } from '@documenso/prisma';

const LEGACY_SERVICE_ACCOUNT_EMAIL = 'serviceaccount@documenso.com';

export const legacyServiceAccountEmail = () => {
  try {
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    if (process.env.NEXT_PRIVATE_LEGACY_SERVICE_ACCOUNT_EMAIL) {
      // eslint-disable-next-line turbo/no-undeclared-env-vars
      return process.env.NEXT_PRIVATE_LEGACY_SERVICE_ACCOUNT_EMAIL;
    }

    const { hostname } = new URL(process.env.NEXT_PUBLIC_WEBAPP_URL || 'http://localhost:3000');

    return `serviceaccount@${hostname}`;
  } catch (error) {
    return LEGACY_SERVICE_ACCOUNT_EMAIL;
  }
};

export const migrateLegacyServiceAccount = async () => {
  if (legacyServiceAccountEmail() !== LEGACY_SERVICE_ACCOUNT_EMAIL) {
    console.log(`Migrating legacy service account to new email: ${legacyServiceAccountEmail()}`);

    await prisma.user.updateMany({
      where: {
        email: LEGACY_SERVICE_ACCOUNT_EMAIL,
      },
      data: {
        email: legacyServiceAccountEmail(),
      },
    });
  }
};
