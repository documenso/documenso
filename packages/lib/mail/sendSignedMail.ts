import { sendMail } from "./sendMail";
import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib/constants";
import { transactionEmailTemplate } from "@documenso/lib/mail";

export const sendSignedMail = async (recipient: any, document: any) => {
  // todo check if recipient has an account
  await sendMail(
    document.User.email,
    `${recipient.email} signed "${document.title}"`,
    transactionEmailTemplate(
      `${document.User.name || recipient.email} has signed your document ${
        document.title
      }`,
      document,
      recipient,
      `${NEXT_PUBLIC_WEBAPP_URL}/documents/${document.id}`,
      `View Document`
    )
  );
};
