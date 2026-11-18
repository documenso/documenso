import { prisma } from '@documenso/prisma';
import { type RecipientRole, SigningStatus } from '@prisma/client';

import { assertAssistantSigningOrder } from '../recipient/assert-assistant-signing-order';

export type UpdateRecipientOptions = {
  id: number;
  name: string | undefined;
  email: string | undefined;
  role: RecipientRole | undefined;
};

export const updateRecipient = async ({ id, name, email, role }: UpdateRecipientOptions) => {
  const recipient = await prisma.recipient.findFirstOrThrow({
    where: {
      id,
    },
    include: {
      envelope: {
        select: {
          documentMeta: {
            select: {
              signingOrder: true,
            },
          },
        },
      },
    },
  });

  if (recipient.signingStatus === SigningStatus.SIGNED) {
    throw new Error('Cannot update a recipient that has already signed.');
  }

  // Only a role change is checked, so an assistant saved before this rule was
  // introduced can still be edited.
  if (role !== recipient.role) {
    assertAssistantSigningOrder({
      signingOrder: recipient.envelope.documentMeta.signingOrder,
      recipients: [{ role }],
    });
  }

  return await prisma.recipient.update({
    where: {
      id,
    },
    data: {
      name,
      email: email?.toLowerCase(),
      role,
    },
  });
};
