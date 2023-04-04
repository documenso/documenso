import { NextApiRequest, NextApiResponse } from "next";
import { getDocument } from "@documenso/lib/query";
import { defaultHandler, defaultResponder, getUserFromToken } from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { Document as PrismaDocument } from "@prisma/client";
import short from "short-uuid";

async function deleteHandler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getUserFromToken(req, res);
  const { id: documentId, rid: recipientId } = req.query;
  const body = req.body;

  if (!recipientId) {
    res.status(400).send("Missing parameter recipientId.");
    return;
  }

  await prisma.recipient.delete({
    where: {
      id: +recipientId,
    },
  });

  return res.status(200).end();
}

export default defaultHandler({
  DELETE: Promise.resolve({ default: defaultResponder(deleteHandler) }),
});
