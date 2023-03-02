import {
  defaultHandler,
  defaultResponder,
  getUserFromToken,
} from "@documenso/lib/server";
import prisma from "@documenso/prisma";
import { NextApiRequest, NextApiResponse } from "next";
import { Document as PrismaDocument } from "@prisma/client";
import { getDocument } from "@documenso/lib/query";
import { addDigitalSignature } from "@documenso/signing/addDigitalSignature";

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const documentId = req.query.id || 1;
  const document: PrismaDocument = await getDocument(+documentId, req, res);
  const signedDocumentAsBase64 = await addDigitalSignature(
    document.document.toString()
  );
  const buffer: Buffer = Buffer.from(signedDocumentAsBase64, "base64");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${document.title}`
  );
  res.setHeader("Content-Length", buffer.length);

  res.status(200).send(buffer);
  return;
}

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(getHandler) }),
});
