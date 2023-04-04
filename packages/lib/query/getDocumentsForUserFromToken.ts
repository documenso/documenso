import { getUserFromToken } from "@documenso/lib/server";
import prisma from "@documenso/prisma";

export const getDocumentsForUserFromToken = async (context: any): Promise<any> => {
  const user = await getUserFromToken(context.req, context.res);
  if (!user) return Promise.reject("Invalid user or token.");

  const documents = await prisma.document.findMany({
    where: {
      userId: user.id,
    },
    include: {
      Recipient: true,
    },
    orderBy: {
      created: "desc",
    },
  });

  return documents.map((e) => ({ ...e, document: "" }));
};
