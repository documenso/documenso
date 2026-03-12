import { prisma } from '@documenso/prisma';

type UnsafeUpdateEnvelopeItemsOptions = {
  envelopeId: string;
  data: {
    envelopeItemId: string;
    order?: number;
    title?: string;
  }[];
};

export const UNSAFE_updateEnvelopeItems = async ({
  envelopeId,
  data,
}: UnsafeUpdateEnvelopeItemsOptions) => {
  // Todo: Envelope [AUDIT_LOGS]

  const updatedEnvelopeItems = await Promise.all(
    data.map(async ({ envelopeItemId, order, title }) =>
      prisma.envelopeItem.update({
        where: {
          envelopeId,
          id: envelopeItemId,
        },
        data: {
          order,
          title,
        },
        select: {
          id: true,
          order: true,
          title: true,
          envelopeId: true,
        },
      }),
    ),
  );

  return updatedEnvelopeItems;
};
