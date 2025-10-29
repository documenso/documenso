import { prisma } from '@documenso/prisma';

export const deletedAccountServiceAccount = async () => {
  const serviceAccount = await prisma.user.findFirst({
    where: {
      email: 'deleted-account@documenso.com',
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
