import { DocumentStatus, EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { type EnvelopeIdOptions } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type UpdateEnvelopeRedactionsOptions = {
  userId: number;
  teamId: number;
  id: EnvelopeIdOptions;
  redactions: {
    id: number;
    page?: number;
    positionX?: number;
    positionY?: number;
    width?: number;
    height?: number;
  }[];
};

export const updateEnvelopeRedactions = async ({
  userId,
  teamId,
  id,
  redactions,
}: UpdateEnvelopeRedactionsOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: envelopeWhereInput,
  });

  if (envelope.status !== DocumentStatus.DRAFT) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Redactions can only be updated while the document is in DRAFT.',
    });
  }

  return await prisma.$transaction(async (tx) =>
    Promise.all(
      redactions.map((r) =>
        tx.redaction.update({
          where: { id: r.id, envelopeId: envelope.id },
          data: {
            page: r.page,
            positionX: r.positionX,
            positionY: r.positionY,
            width: r.width,
            height: r.height,
          },
        }),
      ),
    ),
  );
};
