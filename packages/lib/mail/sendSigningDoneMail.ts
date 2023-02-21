import { sendMail } from "./sendMail";
import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib/constants";
import { signingCompleteTemplate } from "@documenso/lib/mail";

export const sendSigningDoneMail = async (
  recipient: any,
  document: any,
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
        content: Buffer.from(document.document.toString(), "base64"),
      },
    ]
  );
};
