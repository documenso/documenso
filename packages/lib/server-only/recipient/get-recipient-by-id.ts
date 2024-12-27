import type { z } from 'zod';

import { prisma } from '@documenso/prisma';
import { FieldSchema, RecipientSchema } from '@documenso/prisma/generated/zod';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type GetRecipientByIdOptions = {
  recipientId: number;
  userId: number;
  teamId?: number;
};

export const ZGetRecipientByIdResponseSchema = RecipientSchema.extend({
  Field: FieldSchema.array(),
});

export type TGetRecipientByIdResponse = z.infer<typeof ZGetRecipientByIdResponseSchema>;

/**
 * Get a recipient by ID. This will also return the recipient signing token so
 * be careful when using this.
 */
export const getRecipientById = async ({
  recipientId,
  userId,
  teamId,
}: GetRecipientByIdOptions): Promise<TGetRecipientByIdResponse> => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      id: recipientId,
      Document: {
        OR: [
          teamId === undefined
            ? {
                userId,
                teamId: null,
              }
            : {
                teamId,
                team: {
                  members: {
                    some: {
                      userId,
                    },
                  },
                },
              },
        ],
      },
    },
    include: {
      Field: true,
    },
  });

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found',
    });
  }

  return recipient;
};
