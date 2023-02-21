import { sendMail } from "./sendMail";
import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib/constants";
import { transactionEmailTemplate } from "@documenso/lib/mail";

export const sendSigningDoneMail = async (
  recipient: any,
  document: any,
  user: any
) => {
  // todo check if recipient has an account
  await sendMail(
    document.User.email,
    `${recipient.email} signed "${document.title}"`,
    transactionEmailTemplate(
      `All recipients have signed your document ${document.title}`,
      document,
      recipient,
      `${NEXT_PUBLIC_WEBAPP_URL}/api/documents/${document.id}`,
      `Download "${document.title}"`,
      user
    )
  );
};
