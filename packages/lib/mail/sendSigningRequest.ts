import prisma from "@documenso/prisma";
import { sendMail } from "./sendMail";
import { SendStatus, DocumentStatus } from "@prisma/client";
import { NEXT_PUBLIC_WEBAPP_URL } from "../constants";

export const sendSigningRequest = async (recipient: any, document: any) => {
  // todo errror handling
  await sendMail(
    "timur.ercan31+234234@gmail.com",
    `Please sign ${document.title}`,
    `
    <div style="background-color: #eaeaea; padding: 2%;">
      <div style="text-align:center; margin: auto; font-size: 14px; font-color: #353434; max-width: 500px; border-radius: 0.375rem; background: white; padding: 50px">
        <img src="${NEXT_PUBLIC_WEBAPP_URL}/logo_h.png" alt="Documenso Logo" style="width: 180px; display: block; margin: auto; margin-bottom: 14px;
}">
      ${document.User.name} (${document.User.email}) has sent you a document to sign. 
        <p style="margin: 24px;">
          <a href="${NEXT_PUBLIC_WEBAPP_URL}/document/${document.id}/sign?token=${recipient.token}" style="background-color: #37f095; color: white; border-color: transparent; border-width: 1px; border-radius: 0.375rem; font-size: 18px; padding-left: 16px; padding-right: 16px; padding-top: 10px; padding-bottom: 10px; text-decoration: none;">
            Sign Document
          </a>
        </p>
        <hr size="1" style="height:1px;border:none;color:#e0e0e0;background-color:#e0e0e0">
          Click the button to view and sign ${document.title}.<br>
          <small>If you have questions about this document, your should ask ${document.User.name}.</small>
        <hr size="1" style="height:1px;border:none;color:#e0e0e0;background-color:#e0e0e0">
      </div>

      <div style="text-align: left; line-height: 18px; color: #666666; margin: 24px">
        <div>
          <b>Do not forward.</b>
          <br>
          This email contains a link to a secure document. Keep it secret and do not forward this email.
        </div>
        <div style="margin-top: 12px">
          <b>Need help?</b>
          <br>
          Contact us at <a href="mailto:hi@documenso.com">hi@documenso.com</a>  
      </div>
    </div>
    `
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
