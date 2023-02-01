import { getUserFromToken } from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { Document as PrismaDocument } from "@prisma/client";

export const getDocumentsForUserFromToken = async (
  context: any
): Promise<PrismaDocument[]> => {
  const user = await getUserFromToken(context.req, context.res);
  if (!user) return Promise.reject("Invalid user or token.");

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
