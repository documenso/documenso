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
import { sendSigningDoneMail } from "@documenso/lib/mail";

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const existingUser = await getUserFromToken(req, res);
  const { token: recipientToken } = req.query;
  const { signatures: signaturesFromBody }: { signatures: any[] } = req.body;

  if (!recipientToken) {
    return res.status(401).send("Missing recipient token.");
  }

  // The recipient who received the signing request
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

  // todo rename .document to documentImageAsBase64 or sth. like that
  let documentWithSignatureImages = document.document;
  for (const signature of signaturesFromBody) {
    if (!signature.signatureImage && !signature.typedSignature) {
      documentWithSignatureImages = document.document;
      throw new Error("Cant't save invalid signature.");
    }

    await saveSignature(signature);

    const signedField = await prisma.field.findFirstOrThrow({
      where: { id: signature.fieldId },
      include: { Signature: true },
    });

    await insertSignatureInDocument(signedField);
  }

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
      document: documentWithSignatureImages,
      status:
        unsignedRecipients.length > 0
          ? DocumentStatus.PENDING
          : DocumentStatus.COMPLETED,
    },
  });

  if (unsignedRecipients.length === 0) {
    const documentOwner = await prisma.user.findFirstOrThrow({
      where: { id: document.userId },
      select: { email: true, name: true },
    });

    document.document = documentWithSignatureImages;
    if (documentOwner)
      await sendSigningDoneMail(recipient, document, documentOwner);
  }

  return res.status(200).end();

  async function insertSignatureInDocument(signedField: any) {
    if (signedField?.Signature?.signatureImageAsBase64) {
      documentWithSignatureImages = await insertImageInPDF(
        documentWithSignatureImages,
        signedField.Signature
          ? signedField.Signature?.signatureImageAsBase64
          : "",
        signedField.positionX,
        signedField.positionY,
        signedField.page
      );
    } else if (signedField?.Signature?.typedSignature) {
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
  }

  async function saveSignature(signature: any) {
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
  }
}

export default defaultHandler({
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
