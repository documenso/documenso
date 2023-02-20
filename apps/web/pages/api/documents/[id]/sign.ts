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
import { insertImageInPDF, insertTextInPDF } from "@documenso/pdf";
const text2png = require("text2png");

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const existingUser = await getUserFromToken(req, res);
  const { token: recipientToken } = req.query;
  const { signatures: signatures }: { signatures: any[] } = req.body;

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
  // todo insert if not exits
  signatures.forEach(async (signature) => {
    await prisma.signature.create({
      data: {
        recipientId: recipient.id,
        fieldId: signature.fieldId,
        signatureImageAsBase64: signature.signatureImage
          ? signature.signatureImage
          : text2png(signature.typedSignature).toString("base64"),
      },
    });
  });

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

  if (unsignedRecipients.length === 0) {
    // todo if everybody signed insert images and create signature
    const signedFields = await prisma.field.findMany({
      where: { documentId: document.id },
      include: { Signature: true },
    });
    // todo rename .document to documentImageAsBase64 or sth. like that
    let documentWithSignatureImages = document.document;
    let signaturesInserted = 0;
    signedFields.forEach(async (item) => {
      if (!item.Signature) {
        documentWithSignatureImages = document.document;
        throw new Error("Invalid Signature in Field");
      }
      documentWithSignatureImages = await insertImageInPDF(
        documentWithSignatureImages,
        item.Signature ? item.Signature?.signatureImageAsBase64 : "",
        item.positionX,
        item.positionY,
        item.page
      );
      signaturesInserted++;
      if (signaturesInserted == signedFields.length) {
        await prisma.document.update({
          where: {
            id: recipient.documentId,
          },
          data: {
            status: DocumentStatus.COMPLETED,
            document: documentWithSignatureImages,
          },
        });
      }
      // todo send notifications
    });
  }

  return res.status(200).end();
}

export default defaultHandler({
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
