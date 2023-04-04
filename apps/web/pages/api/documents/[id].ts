import { NextApiRequest, NextApiResponse } from "next";
import { getDocument } from "@documenso/lib/query";
import { defaultHandler, defaultResponder, getUserFromToken } from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { addDigitalSignature } from "@documenso/signing/addDigitalSignature";
import { Document as PrismaDocument } from "@prisma/client";

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const { id: documentId } = req.query;
  const { token: recipientToken } = req.query;

  if (!documentId) {
    return res.status(400).send("Missing parameter documentId.");
  }

  let user = null;
  let recipient = null;
  if (recipientToken) {
    // Request from signing page without login
    recipient = await prisma.recipient.findFirst({
      where: {
        token: recipientToken?.toString(),
      },
      include: {
        Document: { include: { User: true } },
      },
    });
    user = recipient?.Document.User;
  } else {
    // Request from editor with valid user login
    user = await getUserFromToken(req, res);
  }

  if (!user) return res.status(401).end();

  let document: PrismaDocument | null = null;
  if (recipientToken) {
    document = await prisma.document.findFirst({
      where: { id: recipient?.Document?.id },
    });
  } else {
    document = await getDocument(+documentId, req, res);
  }

  if (!document) res.status(404).end(`No document with id ${documentId} found.`);

  const signaturesCount = await prisma.signature.count({
    where: {
      Field: {
        documentId: document?.id,
      },
    },
  });

  let signedDocumentAsBase64 = document?.document || "";

  // No need to add a signature, if no one signed yet.
  if (signaturesCount > 0) {
    signedDocumentAsBase64 = await addDigitalSignature(document?.document || "");
  }

  const buffer: Buffer = Buffer.from(signedDocumentAsBase64, "base64");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", buffer.length);
  res.setHeader("Content-Disposition", `attachment; filename=${document?.title}`);

  return res.status(200).send(buffer);
}

async function deleteHandler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getUserFromToken(req, res);
  const { id: documentId } = req.query;

  if (!user) return;

  if (!documentId) {
    res.status(400).send("Missing parameter documentId.");
    return;
  }

  await prisma.document
    .delete({
      where: {
        id: +documentId,
      },
    })
    .then(() => {
      res.status(200).end();
    });
}

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
  DELETE: Promise.resolve({ default: defaultResponder(deleteHandler) }),
});
