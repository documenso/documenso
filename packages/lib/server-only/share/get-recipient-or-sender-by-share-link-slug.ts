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

  throw new Error('Recipient or sender not found');
};
