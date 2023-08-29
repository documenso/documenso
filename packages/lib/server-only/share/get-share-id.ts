import { prisma } from '@documenso/prisma';

export interface GetSharingIdOptions {
  shareId: string;
}

export const getSharingId = async ({ shareId }: GetSharingIdOptions) => {
  const result = await prisma.share.findUnique({
    where: {
      link: shareId,
    },
    include: {
      recipent: true,
    },
  });

  return result;
};
