import nodemailer from 'nodemailer';
import nodemailerSendgrid from 'nodemailer-sendgrid';

import { TSendMailMutationSchema } from '@documenso/trpc/server/mail-router/schema';

import { emailHtml, emailText } from '../../mail/template';

interface SendMail {
  template: TSendMailMutationSchema;
  mail: {
    from: string;
    subject: string;
  };
}

export const sendMail = async ({ template, mail }: SendMail) => {
  let transporter;

  if (process.env.NEXT_PRIVATE_SENDGRID_API_KEY) {
    transporter = nodemailer.createTransport(
      nodemailerSendgrid({
        apiKey: process.env.NEXT_PRIVATE_SENDGRID_API_KEY,
      }),
    );
  }

  if (process.env.NEXT_PRIVATE_SMTP_MAIL_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.NEXT_PRIVATE_SMTP_MAIL_HOST,
      port: Number(process.env.NEXT_PRIVATE_SMTP_MAIL_PORT),
      auth: {
        user: process.env.NEXT_PRIVATE_SMTP_MAIL_USER,
        pass: process.env.NEXT_PRIVATE_SMTP_MAIL_PASSWORD,
      },
    });
  }

  if (!transporter) {
    throw new Error(
      'No mail transport configured. Probably Sendgrid API Key nor SMTP Mail host was set',
    );
  }

  await transporter.sendMail({
    from: mail.from,
    to: template.email,
    subject: mail.subject,
    text: emailText({ ...template }),
    html: emailHtml({ ...template }),
  });
};
