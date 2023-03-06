import { getUserFromToken } from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { Document as PrismaDocument } from "@prisma/client";

export const getDocument = async (
  documentId: number,
  req: any,
  res: any
): Promise<PrismaDocument> => {
  const user = await getUserFromToken(req, res);
  if (!user) return Promise.reject("Invalid user or token.");
  if (!documentId) Promise.reject("No documentId");
  if (!req || !res) Promise.reject("No res or req");

  const document: PrismaDocument = await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
      userId: user.id,
    },
    include: {
      Recipient: {
        orderBy: {
          id: "asc",
        },
      },
      Field: { include: { Recipient: true, Signature: true } },
    },
  });

  return document;
};
