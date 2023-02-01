import { getUserFromToken } from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { Document as PrismaDocument } from "@prisma/client";

export const getDocumentsForUserFromToken = async (
  ssrContext: any
): Promise<PrismaDocument[]> => {
  const user = await getUserFromToken(ssrContext.req, ssrContext.res);
  if (!user) return Promise.reject("Invalid user or token.s");

  const documents: PrismaDocument[] = await prisma.document.findMany({
    where: {
      userId: user.id,
    },
    include: {
      Recipient: true,
    },
  });

  return documents;
};
