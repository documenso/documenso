import { sendMail } from "./sendMail";
import { signingCompleteTemplate } from "@documenso/lib/mail";
import { Document as PrismaDocument } from "@prisma/client";
import { addDigitalSignature } from "@documenso/signing/addDigitalSignature";

export const sendSigningDoneMail = async (
  recipient: any,
  document: PrismaDocument,
  user: any
) => {
  await sendMail(
    user.email,
    `Completed: "${document.title}"`,
    // base template with footer and box vs content template for eact type
    signingCompleteTemplate(`All recipients have signed "${document.title}".`),
    [
      {
        filename: document.title,
        content: Buffer.from(
          await addDigitalSignature(document.document),
          "base64"
        ),
      },
    ]
  );
};
