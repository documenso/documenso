import { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { type EnvelopeIdOptions } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type DeleteTemplateOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
};

export const deleteTemplate = async ({ id, userId, teamId }: DeleteTemplateOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.TEMPLATE,
    userId,
    teamId,
  });

  return await prisma.envelope.delete({
    where: envelopeWhereInput,
  });
};
