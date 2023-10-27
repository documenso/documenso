import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { ConfirmEmailTemplate } from '@documenso/email/templates/confirm-email';
import { prisma } from '@documenso/prisma';

export interface SendConfirmationEmailProps {
  userId: number;
}

export const sendConfirmationEmail = async ({ userId }: SendConfirmationEmailProps) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    include: {
      VerificationToken: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  const token = user.VerificationToken[0].token;
  const assetBaseUrl = process.env.NEXT_PUBLIC_WEBAPP_URL || 'http://localhost:3000';
  const confirmationLink = `${process.env.NEXT_PUBLIC_WEBAPP_URL}/confirm-email/?token=${token}`;
  const senderName = process.env.NEXT_PRIVATE_SMTP_FROM_NAME || 'Documenso';
  const senderAdress = process.env.NEXT_PRIVATE_SMTP_FROM_ADDRESS || 'noreply@documenso.com';

  const confirmationTemplate = createElement(ConfirmEmailTemplate, {
    assetBaseUrl,
    confirmationLink,
  });

  return await mailer.sendMail({
    to: {
      address: user.email,
      name: user.name || '',
    },
    from: {
      name: senderName,
      address: senderAdress,
    },
    subject: 'Please confirm your email',
    html: render(confirmationTemplate),
    text: render(confirmationTemplate, { plainText: true }),
  });
};
