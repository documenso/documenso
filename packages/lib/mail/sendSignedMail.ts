import { sendMail } from "./sendMail";
import { NEXT_PUBLIC_WEBAPP_URL } from "@documenso/lib/constants";

export const sendSignedMail = async (document: any, recipient: any) => {
  // todo check if recipient has an account

  sendMail(
    document.user.email,
    `${recipient.email} signed ${document.title}`,
    `Hi ${document.user.name}, ${recipient.email} has signed your document ${document.title}. Click <a href="${NEXT_PUBLIC_WEBAPP_URL}/document/${document.id}"> VIEW DOCUMENT</a> to view it now.`
  );
};
