import { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type DeleteTemplateOptions = {
  id: number;
  userId: number;
  teamId: number;
};

export const deleteTemplate = async ({ id, userId, teamId }: DeleteTemplateOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'templateId',
      id,
    },
    type: EnvelopeType.TEMPLATE,
    userId,
    teamId,
  });

  return await prisma.envelope.delete({
    where: envelopeWhereInput,
  });
};
