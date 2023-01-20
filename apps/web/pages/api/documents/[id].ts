import {
  defaultHandler,
  defaultResponder,
  getUserFromToken,
} from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { NextApiRequest, NextApiResponse } from "next";
import { useRouter } from "next/router";

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
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

  res.status(200).json(document);
}

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
});
