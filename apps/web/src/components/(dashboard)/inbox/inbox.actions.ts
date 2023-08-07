'use server';

import { z } from 'zod';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { prisma } from '@documenso/prisma';

export async function updateRecipientReadStatus(recipientId: number, documentId: number) {
  z.number().parse(recipientId);
  z.number().parse(documentId);

  const { email } = await getRequiredServerComponentSession();

  await prisma.recipient.update({
    where: {
      id: recipientId,
      documentId,
      email,
    },
    data: {
      readStatus: 'OPENED',
    },
  });
}
