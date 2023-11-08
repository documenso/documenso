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

  const sender = await prisma.user.findFirst({
    where: {
      Document: { some: { id: documentId } },
      email,
    },
  });

  if (sender) {
    return sender;
  }

  throw new Error('Recipient or sender not found');
};
