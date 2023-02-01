import {
  defaultHandler,
  defaultResponder,
  getUserFromToken,
} from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { NextApiRequest, NextApiResponse } from "next";
import { SigningStatus, DocumentStatus } from "@prisma/client";
import { getDocument } from "@documenso/lib/query";
import { Document as PrismaDocument } from "@prisma/client";

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const existingUser = await getUserFromToken(req, res);
  const { token: recipientToken } = req.query;

  if (!recipientToken) {
    res.status(401).send("Missing recipient token.");
    return;
  }

  const recipient = await prisma.recipient.findFirstOrThrow({
    where: { token: recipientToken?.toString() },
  });

  if (!recipient) {
    res.status(401).send("Recipient not found.");
    return;
  }

  const document: PrismaDocument = await getDocument(
    recipient.documentId,
    res,
    req
  );

  if (!document) res.status(404).end(`No document found.`);

  // todo sign stuff

  const unsignedRecipients = await prisma.recipient.findMany({
    where: {
      signingStatus: SigningStatus.NOT_SIGNED,
    },
  });

  if (unsignedRecipients.length === 0) {
    await prisma.document.update({
      where: {
        id: recipient.documentId,
      },
      data: {
        status: DocumentStatus.COMPLETED,
      },
    });
  }

  await prisma.recipient.update({
    where: {
      id: recipient.id,
    },
    data: {
      signingStatus: SigningStatus.SIGNED,
    },
  });

  return res.status(200).end();
}

export default defaultHandler({
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
