import { sendMail } from "./sendMail";
export const sendSigningRequestMail = async (recipient: any, document: any) => {
  await sendMail(
    recipient.email,
    `Please sign ${document.title}`,
    `${document.User.name} has sent you a document to sign. Click <b><a href="${process.env.NEXT_PUBLIC_WEBAPP_URL}/documents/${document.id}/sign">SIGN DOCUMENT</a></b> to sign it now.`
  );
};
