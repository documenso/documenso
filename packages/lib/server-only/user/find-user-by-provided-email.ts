import { prisma } from '@documenso/prisma';

export type FindUserByProvidedEmailOptions = {
  email: string;
};

/**
 * Emails are stored lowercase, but accounts created through SSO before that was enforced can
 * still hold the casing the provider sent. A row in the provided casing wins over the lowercase
 * row so those accounts keep resolving to themselves instead of to a case-variant duplicate.
 */
export const findUserByProvidedEmail = async ({ email }: FindUserByProvidedEmailOptions) => {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [email, email.toLowerCase()],
      },
    },
  });

  const exact = users.find((user) => user.email === email);

  if (exact) {
    return exact;
  }

  return users.at(0) ?? null;
};
