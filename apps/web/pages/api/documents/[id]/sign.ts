import {
  defaultHandler,
  defaultResponder,
  getUserFromToken,
} from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { NextApiRequest, NextApiResponse } from "next";

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const user = getUserFromToken(req, res);
  const { id: documentId } = req.query;
  if (!user) return;

  if (!documentId) {
    res.status(400).send("Missing parameter documentId.");
    return;
  }

  let document = await prisma.document.findFirst({
    where: {
      id: +documentId,
    },
  });

  if (!document)
    res.status(404).end(`No document with id ${documentId} found.`);

  // todo sign stuff

  res.status(200);
}

export default defaultHandler({
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
