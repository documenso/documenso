import { prisma } from '@documenso/prisma';
import type { Role } from '@prisma/client';

export type UpdateUserOptions = {
  id: number;
  name: string | null | undefined;
  email: string | undefined;
  roles: Role[] | undefined;
};

export const updateUser = async ({ id, name, email, roles }: UpdateUserOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id,
    },
    select: {
      email: true,
    },
  });

  // The admin form resubmits the stored email on every save. Leave it untouched when unchanged
  // so a legacy mixed-case account that has a lowercase twin can still have its name or roles edited.
  const hasEmailChanged = email !== undefined && email !== user.email;

  await prisma.user.update({
    where: {
      id,
    },
    data: {
      name,
      email: hasEmailChanged ? email.toLowerCase() : undefined,
      roles,
    },
  });
};
