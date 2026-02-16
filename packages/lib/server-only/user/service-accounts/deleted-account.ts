import { prisma } from '@documenso/prisma';

const LEGACY_DELETED_ACCOUNT_EMAIL = 'deleted-account@documenso.com';

export const deletedServiceAccountEmail = () => {
  try {
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    if (process.env.NEXT_PRIVATE_DELETED_SERVICE_ACCOUNT_EMAIL) {
      // eslint-disable-next-line turbo/no-undeclared-env-vars
      return process.env.NEXT_PRIVATE_DELETED_SERVICE_ACCOUNT_EMAIL;
    }

    const { hostname } = new URL(process.env.NEXT_PUBLIC_WEBAPP_URL || 'http://localhost:3000');

    return `deleted-account@${hostname}`;
  } catch (error) {
    return LEGACY_DELETED_ACCOUNT_EMAIL;
  }
};

export const deletedAccountServiceAccount = async () => {
  const serviceAccount = await prisma.user.findFirst({
    where: {
      email: deletedServiceAccountEmail(),
    },
    select: {
      id: true,
      email: true,
      ownedOrganisations: {
        select: {
          id: true,
          teams: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!serviceAccount) {
    throw new Error(
      'Deleted account service account not found, have you ran the appropriate migrations?',
    );
  }

  return serviceAccount;
};

export const migrateDeletedAccountServiceAccount = async () => {
  if (deletedServiceAccountEmail() !== LEGACY_DELETED_ACCOUNT_EMAIL) {
    console.log(
      `Migrating deleted account service account to new email: ${deletedServiceAccountEmail()}`,
    );

    await prisma.user.updateMany({
      where: {
        email: LEGACY_DELETED_ACCOUNT_EMAIL,
      },
      data: {
        email: deletedServiceAccountEmail(),
      },
    });
  }
};
