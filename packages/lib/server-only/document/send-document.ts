import nodemailer from 'nodemailer';
import nodemailerSendgrid from 'nodemailer-sendgrid';

export const sendMail = async ({ email }: { email: string }) => {
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
    from: 'Documenso <hi@documenso.com>',
    to: email,
    subject: 'Welcome to Documenso!',
    text: 'Welcome to Documenso!',
    html: '<p>Welcome to Documenso!</p>',
  });
};
