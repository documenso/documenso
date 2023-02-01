import { getUserFromToken } from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { Document as PrismaDocument } from "@prisma/client";

export const getDocument = async (
  documentId: number,
  context: any
): Promise<PrismaDocument> => {
  const user = await getUserFromToken(context.req, context.res);
  if (!user) return Promise.reject("Invalid user or token.");
  if (!documentId) Promise.reject("No documentId");
  if (!context) Promise.reject("No context");

  const document: PrismaDocument = await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
      userId: user.id,
    },
    include: {
      Recipient: true,
    },
  });

  return document;
};
