import { createElement } from 'react';

import { mailer } from '@documenso/email/mailer';
import { render } from '@documenso/email/render';
import { ConfirmEmailTemplate } from '@documenso/email/templates/confirm-email';
import { prisma } from '@documenso/prisma';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';

export interface SendConfirmationEmailProps {
  userId: number;
}

export const sendConfirmationEmail = async ({ userId }: SendConfirmationEmailProps) => {
  const NEXT_PRIVATE_SMTP_FROM_NAME = process.env.NEXT_PRIVATE_SMTP_FROM_NAME;
  const NEXT_PRIVATE_SMTP_FROM_ADDRESS = process.env.NEXT_PRIVATE_SMTP_FROM_ADDRESS;

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

  const [verificationToken] = user.VerificationToken;

  if (!verificationToken?.token) {
    throw new Error('Verification token not found for the user');
  }

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';
  const confirmationLink = `${assetBaseUrl}/verify-email/${verificationToken.token}`;
  const senderName = NEXT_PRIVATE_SMTP_FROM_NAME || 'Documenso';
  const senderAdress = NEXT_PRIVATE_SMTP_FROM_ADDRESS || 'noreply@documenso.com';

  const confirmationTemplate = createElement(ConfirmEmailTemplate, {
    assetBaseUrl,
    confirmationLink,
  });

  return mailer.sendMail({
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
