import { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export interface GetRecipientsForTemplateOptions {
  templateId: number;
  userId: number;
  teamId: number;
}

export const getRecipientsForTemplate = async ({
  templateId,
  userId,
  teamId,
}: GetRecipientsForTemplateOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'templateId',
      id: templateId,
    },
    type: EnvelopeType.TEMPLATE,
    userId,
    teamId,
  });

  const recipients = await prisma.recipient.findMany({
    where: {
      envelope: envelopeWhereInput,
    },
    orderBy: {
      id: 'asc',
    },
  });

  return recipients;
};
