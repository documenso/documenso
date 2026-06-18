import { prisma } from '@documenso/prisma';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { createPersonalOrganisation } from '../organisation/create-organisation';

export interface CreateAdminUserOptions {
  name: string;
  email: string;
}

/**
 * Create a user for admin-initiated flows.
 *
 * Unlike normal signup, this function:
 * - Leaves the password unset (`null`); the user must set it later via a password reset/onboarding link
 * - Marks the email as verified immediately because this route is only called by admins
 */
export const createAdminUser = async ({ name, email }: CreateAdminUserOptions) => {
  const userExists = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
    },
  });

  if (userExists) {
    throw new AppError(AppErrorCode.ALREADY_EXISTS, {
      message: 'User with this email already exists',
    });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      password: null,
      // Verifying the email here instead of the password reset flow to reduce the
      // attack surface. This route is only called by admins.
      emailVerified: new Date(),
    },
  });

  await createPersonalOrganisation({ userId: user.id, throwErrorOnOrganisationCreationFailure: true });

  return user;
};
