import prisma from "@documenso/prisma";
import { sendMail } from "./sendMail";
import { SendStatus, DocumentStatus } from "@prisma/client";
import { NEXT_PUBLIC_WEBAPP_URL } from "../constants";
import { transactionEmailTemplate } from "@documenso/lib/mail";

export const sendSigningRequest = async (
  recipient: any,
  document: any,
  user: any
) => {
  await sendMail(
    user.email,
    `Please sign ${document.title}`,
    transactionEmailTemplate(
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
