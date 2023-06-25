import { SigningDoneTemplate } from "@documenso/email-templates";
import { addDigitalSignature } from "@documenso/signing/addDigitalSignature";
import { NEXT_PUBLIC_WEBAPP_URL } from "../constants";
import { sendMail } from "./sendMail";
import { Document as PrismaDocument } from "@prisma/client";
import { render } from "@react-email/render";

export const sendSigningDoneMail = async (document: PrismaDocument, user: any) => {
  await sendMail(
    user.email,
    `Completed: "${document.title}"`,
    render(
      SigningDoneTemplate({
        message: `All recipients have signed "${document.title}".`,
        publicUrl: NEXT_PUBLIC_WEBAPP_URL ?? "http:localhost:3000",
      })
    ),
    [
      {
        filename: document.title,
        content: Buffer.from(await addDigitalSignature(document.document), "base64"),
      },
    ]
  );
};
