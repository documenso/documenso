import { NextApiRequest, NextApiResponse } from "next";
import { sendSigningDoneMail } from "@documenso/lib/mail";
import { getDocument } from "@documenso/lib/query";
import { defaultHandler, defaultResponder } from "@documenso/lib/server";
import { insertImageInPDF, insertTextInPDF } from "@documenso/pdf";
import prisma from "@documenso/prisma";
import { DocumentStatus, SigningStatus } from "@prisma/client";
import { FieldType, Document as PrismaDocument } from "@prisma/client";

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
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

  const document: PrismaDocument = await prisma.document.findFirstOrThrow({
    where: {
      id: recipient.documentId,
    },
    include: {
      Recipient: {
        orderBy: {
          id: "asc",
        },
      },
      Field: { include: { Recipient: true, Signature: true } },
    },
  });

  if (!document) res.status(404).end(`No document found.`);

  let documentWithInserts = document.document;
  for (const signature of signaturesFromBody) {
    if (!signature.signatureImage && !signature.typedSignature) {
      documentWithInserts = document.document;
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
      signedAt: new Date(),
    },
  });

  const unsignedRecipients = await prisma.recipient.findMany({
    where: {
      documentId: recipient.documentId,
      signingStatus: SigningStatus.NOT_SIGNED,
    },
  });

  const signedRecipients = await prisma.recipient.findMany({
    where: {
      documentId: recipient.documentId,
      signingStatus: SigningStatus.SIGNED,
    },
  });

  // Don't check for inserted, because currently no "sign again" scenarios exist and
  // this is probably the expected behaviour in unclean states.
  const nonSignatureFields = await prisma.field.findMany({
    where: {
      documentId: document.id,
      type: { in: [FieldType.DATE, FieldType.TEXT] },
      recipientId: { in: signedRecipients.map((r) => r.id) },
    },
    include: {
      Recipient: true,
    }
  });

  // Insert fields other than signatures
  for (const field of nonSignatureFields) {
    documentWithInserts = await insertTextInPDF(
      documentWithInserts,
      field.type === FieldType.DATE
        ? new Intl.DateTimeFormat("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }).format(field.Recipient?.signedAt ?? new Date())
        : field.customText || "",
      field.positionX,
      field.positionY,
      field.page,
      false
    );

    await prisma.field.update({
      where: {
        id: field.id,
      },
      data: {
        inserted: true,
      },
    });
  }

  await prisma.document.update({
    where: {
      id: recipient.documentId,
    },
    data: {
      document: documentWithInserts,
      status: unsignedRecipients.length > 0 ? DocumentStatus.PENDING : DocumentStatus.COMPLETED,
    },
  });

  if (unsignedRecipients.length === 0) {
    const documentOwner = await prisma.user.findFirstOrThrow({
      where: { id: document.userId },
      select: { email: true, name: true },
    });

    document.document = documentWithInserts;
    if (documentOwner) await sendSigningDoneMail(document, documentOwner);

    for (const signer of signedRecipients) {
      await sendSigningDoneMail(document, signer);
    }
  }

  return res.status(200).end();

  async function insertSignatureInDocument(signedField: any) {
    if (signedField?.Signature?.signatureImageAsBase64) {
      documentWithInserts = await insertImageInPDF(
        documentWithInserts,
        signedField.Signature ? signedField.Signature?.signatureImageAsBase64 : "",
        signedField.positionX,
        signedField.positionY,
        signedField.page
      );
    } else if (signedField?.Signature?.typedSignature) {
      documentWithInserts = await insertTextInPDF(
        documentWithInserts,
        signedField.Signature.typedSignature,
        signedField.positionX,
        signedField.positionY,
        signedField.page
      );
    } else {
      documentWithInserts = document.document;
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
        signatureImageAsBase64: signature.signatureImage ? signature.signatureImage : null,
        typedSignature: signature.typedSignature ? signature.typedSignature : null,
      },
    });
  }
}

export default defaultHandler({
  POST: Promise.resolve({ default: defaultResponder(postHandler) }),
});
