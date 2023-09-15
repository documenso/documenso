import { NextApiRequest, NextApiResponse } from "next";
import { defaultHandler, defaultResponder } from "@documenso/lib/server";
import prisma from "@documenso/prisma";

async function deleteHandler(req: NextApiRequest, res: NextApiResponse) {
  const { id: documentId, rid: recipientId } = req.query;

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
