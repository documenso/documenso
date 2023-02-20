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
import { create } from "domain";
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
    if (!signature.signatureImage && !signature.typedSignature)
      throw new Error("Cant't save invalid signature.");

    await prisma.signature.upsert({
      where: {
        fieldId: signature.fieldId,
      },
      update: {},
      create: {
        recipientId: recipient.id,
        fieldId: signature.fieldId,
        signatureImageAsBase64: signature.signatureImage
          ? signature.signatureImage
          : null,
        typedSignature: signature.typedSignature
          ? signature.typedSignature
          : null,
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

  console.log("unsignedRecipients.length.." + unsignedRecipients.length);
  if (unsignedRecipients.length === 0) {
    // todo if everybody signed insert images and create signature
    const signedFields = await prisma.field.findMany({
      where: { documentId: document.id },
      include: { Signature: true },
    });
    // todo rename .document to documentImageAsBase64 or sth. like that
    let documentWithSignatureImages = document.document;
    let signaturesInserted = 0;
    signedFields.forEach(async (signedField) => {
      if (!signedField.Signature) {
        documentWithSignatureImages = document.document;
        throw new Error("Invalid Signature in Field");
      }

      if (signedField.Signature.signatureImageAsBase64) {
        documentWithSignatureImages = await insertImageInPDF(
          documentWithSignatureImages,
          signedField.Signature
            ? signedField.Signature?.signatureImageAsBase64
            : "",
          signedField.positionX,
          signedField.positionY,
          signedField.page
        );
      } else if (signedField.Signature.typedSignature) {
        console.log("inserting text");
        documentWithSignatureImages = await insertTextInPDF(
          documentWithSignatureImages,
          signedField.Signature.typedSignature,
          signedField.positionX,
          signedField.positionY,
          signedField.page
        );
      } else {
        documentWithSignatureImages = document.document;
        throw new Error("Invalid signature could not be inserted.");
      }

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
