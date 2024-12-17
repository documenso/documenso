import { prisma } from '@documenso/prisma';

export type DisableUserOptions = {
  id: number;
};

// TODO: Do this properly
export const disableUser = async ({ id }: DisableUserOptions) => {
  const user = await prisma.user.findFirst({
    where: {
      id,
    },
    include: {
      ownedTeams: true,
      ApiToken: true,
      Webhooks: true,
      passkeys: true,
      VerificationToken: true,
      PasswordResetToken: true,
      Subscription: true,
      sessions: true,
    },
  });

  if (!user) {
    throw new Error('There was an error disabling the user');
  }

  try {
    await prisma.user.update({
      where: { id },
      data: { disabled: true },
    });
  } catch (error) {
    console.error('Error disabling user', error);
    throw error;
  }
};
