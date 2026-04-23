import { DocumentStatus, EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { type EnvelopeIdOptions } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type DeleteEnvelopeRedactionOptions = {
  userId: number;
  teamId: number;
  id: EnvelopeIdOptions;
  redactionId: number;
};

export const deleteEnvelopeRedaction = async ({
  userId,
  teamId,
  id,
  redactionId,
}: DeleteEnvelopeRedactionOptions) => {
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
      message: 'Redactions can only be deleted while the document is in DRAFT.',
    });
  }

  // Idempotent: client-side diffing can race with concurrent creates and ask
  // us to delete a row that was never committed or that is already gone. Use
  // deleteMany so the operation succeeds either way — there's nothing to do
  // when the row doesn't exist.
  await prisma.redaction.deleteMany({
    where: { id: redactionId, envelopeId: envelope.id },
  });
};
