import { AppError } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

export type DisableUserOptions = {
  id: number;
};

export const disableUser = async ({ id }: DisableUserOptions) => {
  const user = await prisma.user.findFirst({
    where: {
      id,
    },
    include: {
      apiTokens: true,
      webhooks: true,
      passkeys: true,
      verificationTokens: true,
      passwordResetTokens: true,
    },
  });

  if (!user) {
    throw new AppError('There was an error disabling the user');
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { disabled: true },
      });

      await tx.apiToken.updateMany({
        where: { userId: id },
        data: {
          expires: new Date(),
        },
      });

      await tx.webhook.updateMany({
        where: { userId: id },
        data: {
          enabled: false,
        },
      });

      await tx.verificationToken.updateMany({
        where: { userId: id },
        data: {
          expires: new Date(),
        },
      });

      await tx.passwordResetToken.updateMany({
        where: { userId: id },
        data: {
          expiry: new Date(),
        },
      });

      await tx.passkey.deleteMany({
        where: { userId: id },
      });
    });
  } catch (error) {
    console.error('Error disabling user', error);
    throw error;
  }
};
