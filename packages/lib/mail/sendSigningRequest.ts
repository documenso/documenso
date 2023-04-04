import { signingRequestTemplate } from "@documenso/lib/mail";
import prisma from "@documenso/prisma";
import { NEXT_PUBLIC_WEBAPP_URL } from "../constants";
import { sendMail } from "./sendMail";
import { DocumentStatus, ReadStatus, SendStatus } from "@prisma/client";

export const sendSigningRequest = async (recipient: any, document: any, user: any) => {
  const signingRequestMessage = user.name
    ? `${user.name} (${user.email}) has sent you a document to sign. `
    : `${user.email} has sent you a document to sign. `;

  await sendMail(
    recipient.email,
    `Please sign ${document.title}`,
    signingRequestTemplate(
      signingRequestMessage,
      document,
      recipient,
      `${NEXT_PUBLIC_WEBAPP_URL}/documents/${document.id}/sign?token=${recipient.token}`,
      `Sign Document`,
      user
    )
  ).catch((err) => {
    throw err;
  });

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 60);

  await prisma.recipient.update({
    where: {
      id: recipient.id,
    },
    data: {
      sendStatus: SendStatus.SENT,
      readStatus: ReadStatus.NOT_OPENED,
      expired: expiryDate,
    },
  });

  await prisma.document.update({
    where: {
      id: document.id,
    },
    data: { status: DocumentStatus.PENDING },
  });
};
