import prisma from "@documenso/prisma";
import { sendMail } from "./sendMail";
import { SendStatus, ReadStatus, DocumentStatus } from "@prisma/client";
import { NEXT_PUBLIC_WEBAPP_URL } from "../constants";
import { signingRequestTemplate } from "@documenso/lib/mail";

export const sendSigningRequest = async (
  recipient: any,
  document: any,
  user: any
) => {
  await sendMail(
    user.email,
    `Please sign ${document.title}`,
    signingRequestTemplate(
      `${user.name} (${user.email}) has sent you a document to sign. `,
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
