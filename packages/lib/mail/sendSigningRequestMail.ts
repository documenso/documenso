import { sendMail } from "./sendMail";

export const sendSigningRequestMail = async (recipient: any, document: any) => {
  sendMail(
    recipient.email,
    `Please sign ${document.title}`,
    `${document.user.name} has sent you a document to sign. Click <b><a href="https">SIGN DOCUMENT</a></b> to sign it now.`
  );
};
