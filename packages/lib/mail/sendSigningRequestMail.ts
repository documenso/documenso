import prisma from "@documenso/prisma";
import { sendMail } from "./sendMail";
import { SendStatus, DocumentStatus } from "@prisma/client";

export const sendSigningRequest = async (recipient: any, document: any) => {
  // todo errror handling
  await sendMail(
    recipient.email,
    `Please sign ${document.title}`,
    `${document.User.name} has sent you a document to sign. Click <b><a href="${process.env.NEXT_PUBLIC_WEBAPP_URL}/documents/${document.id}/sign">SIGN DOCUMENT</a></b> to sign it now.`
  );

  await prisma.recipient.update({
    where: {
      id: recipient.id,
    },
    data: { sendStatus: SendStatus.SENT },
  });

  await prisma.document.update({
    where: {
      id: document.id,
    },
    data: { status: DocumentStatus.PENDING },
  });
};
