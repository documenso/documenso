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
    return res.status(401).send("Missing recipient token.");
  }

  const recipient = await prisma.recipient.findFirstOrThrow({
    where: { token: recipientToken?.toString() },
  });

  if (!recipient) {
    return res.status(401).send("Recipient not found.");
  }

  const document: PrismaDocument = await getDocument(
    recipient.documentId,
    req,
    res
  );

  if (!document) res.status(404).end(`No document found.`);

  // save signature to db for later use

  await prisma.recipient.update({
    where: {
      id: recipient.id,
    },
    data: {
      signingStatus: SigningStatus.SIGNED,
    },
  });

  const unsignedRecipients = await prisma.recipient.findMany({
    where: {
      documentId: recipient.documentId,
      signingStatus: SigningStatus.NOT_SIGNED,
    },
  });

  await prisma.document.update({
    where: {
      id: recipient.documentId,
    },
    data: {
      status: DocumentStatus.COMPLETED,
    },
  });

  if (unsignedRecipients.length === 0) {
    // if everybody signed insert images and create signature
    await prisma.document.update({
      where: {
        id: recipient.documentId,
      },
      data: {
        status: DocumentStatus.COMPLETED,
      },
    });
    // send notifications
  }

  return res.status(200).end();
}

export default defaultHandler({
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
