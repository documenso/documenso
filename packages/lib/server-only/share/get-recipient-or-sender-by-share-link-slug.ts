import { prisma } from '@documenso/prisma';

export type GetRecipientOrSenderByShareLinkSlugOptions = {
  slug: string;
};

export const getRecipientOrSenderByShareLinkSlug = async ({
  slug,
}: GetRecipientOrSenderByShareLinkSlugOptions) => {
  const { documentId, email } = await prisma.documentShareLink.findFirstOrThrow({
    where: {
      slug,
    },
  });

<<<<<<< HEAD
=======
  const sender = await prisma.user.findFirst({
    where: {
      Document: { some: { id: documentId } },
      email,
    },
    select: {
      email: true,
      name: true,
      signature: true,
    },
  });

  if (sender) {
    return sender;
  }

>>>>>>> main
  const recipient = await prisma.recipient.findFirst({
    where: {
      documentId,
      email,
    },
    include: {
      Signature: true,
    },
  });

  if (recipient) {
    return recipient;
  }

<<<<<<< HEAD
  const sender = await prisma.user.findFirst({
    where: {
      Document: { some: { id: documentId } },
      email,
    },
  });

  if (sender) {
    return sender;
  }

=======
>>>>>>> main
  throw new Error('Recipient or sender not found');
};
