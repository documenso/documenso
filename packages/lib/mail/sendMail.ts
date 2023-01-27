import nodemailer from "nodemailer";
import nodemailerSendgrid from "nodemailer-sendgrid";

export const sendMail = async (
  to: string,
  subject: string,
  htmlFormattedMessage: string
) => {
  if (!process.env.SENDGRID_API_KEY)
    throw new Error("Sendgrid API Key not set.");

  const transport = nodemailer.createTransport(
    nodemailerSendgrid({
      apiKey: process.env.SENDGRID_API_KEY || "",
    })
  );

  await transport.sendMail({
    from: process.env.MAIL_FROM,
    to: to,
    subject: subject,
    html: htmlFormattedMessage,
  });
};
