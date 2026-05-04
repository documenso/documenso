import { DocumentStatus, EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { prefixedId } from '../../universal/id';
import { type EnvelopeIdOptions } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type CreateEnvelopeRedactionsOptions = {
  userId: number;
  teamId: number;
  id: EnvelopeIdOptions;
  redactions: {
    envelopeItemId: string;
    page: number;
    positionX: number;
    positionY: number;
    width: number;
    height: number;
  }[];
};

export const createEnvelopeRedactions = async ({
  userId,
  teamId,
  id,
  redactions,
}: CreateEnvelopeRedactionsOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: envelopeWhereInput,
    include: { envelopeItems: { select: { id: true } } },
  });

  if (envelope.status !== DocumentStatus.DRAFT) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Redactions can only be added while the document is in DRAFT.',
    });
  }

  const validItemIds = new Set(envelope.envelopeItems.map((i) => i.id));
  for (const redaction of redactions) {
    if (!validItemIds.has(redaction.envelopeItemId)) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `Envelope item ${redaction.envelopeItemId} does not belong to this envelope.`,
      });
    }
  }

  return await prisma.$transaction(async (tx) =>
    Promise.all(
      redactions.map((r) =>
        tx.redaction.create({
          data: {
            envelopeId: envelope.id,
            envelopeItemId: r.envelopeItemId,
            page: r.page,
            positionX: r.positionX,
            positionY: r.positionY,
            width: r.width,
            height: r.height,
            secondaryId: prefixedId('rdx'),
          },
        }),
      ),
    ),
  );
};
