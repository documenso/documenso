import { SigningRequestTemplate } from "@documenso/email-templates";
import prisma from "@documenso/prisma";
import { NEXT_PUBLIC_WEBAPP_URL } from "../constants";
import { sendMail } from "./sendMail";
import { DocumentStatus, ReadStatus, SendStatus } from "@prisma/client";
import { render } from "@react-email/render";

export const sendSigningRequest = async (recipient: any, document: any, user: any) => {
  const signingRequestMessage = user.name
    ? `${user.name} (${user.email}) has sent you a document to sign. `
    : `${user.email} has sent you a document to sign. `;

  await sendMail(
    recipient.email,
    `Please sign ${document.title}`,
    render(
      SigningRequestTemplate({
        ctaLabel: "Sign Document",
        ctaLink: `${NEXT_PUBLIC_WEBAPP_URL}/documents/${document.id}/sign?token=${recipient.token}`,
        message: signingRequestMessage,
        title: document.title,
        userName: user.name,
        publicUrl: NEXT_PUBLIC_WEBAPP_URL ?? "http:localhost:3000",
      })
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
