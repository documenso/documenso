import nodemailer from "nodemailer";
import nodemailerSendgrid from "nodemailer-sendgrid";

export const sendMail = async (
  to: string,
  subject: string,
  body: string,
  attachments: {
    filename: string;
    content: string | Buffer;
  }[] = []
) => {
  let transport;
  if (process.env.SENDGRID_API_KEY)
    transport = nodemailer.createTransport(
      nodemailerSendgrid({
        apiKey: process.env.SENDGRID_API_KEY || "",
      })
    );

  if (process.env.SMTP_MAIL_HOST)
    transport = nodemailer.createTransport({
      host: process.env.SMTP_MAIL_HOST || "",
      port: Number(process.env.SMTP_MAIL_PORT) || 587,
      auth: {
        user: process.env.SMTP_MAIL_USER || "",
        pass: process.env.SMTP_MAIL_PASSWORD || "",
      },
    });

  if (!transport)
    throw new Error(
      "No valid transport for NodeMailer found. Probably Sendgrid API Key nor SMTP Mail host was set."
    );

  await transport
    .sendMail({
      from: process.env.MAIL_FROM,
      to: to,
      subject: subject,
      html: body,
      attachments: attachments,
    })
    .catch((err) => {
      throw err;
    });
};
