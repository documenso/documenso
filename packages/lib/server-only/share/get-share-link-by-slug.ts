import { prisma } from '@documenso/prisma';

export type GetShareLinkBySlugOptions = {
  slug: string;
};

export const getShareLinkBySlug = async ({ slug }: GetShareLinkBySlugOptions) => {
  return await prisma.documentShareLink.findFirstOrThrow({
    where: {
      slug,
    },
  });
};
