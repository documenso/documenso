import { prisma } from '@documenso/prisma';

export type TransferTeamEnvelopesOptions = {
  sourceTeamId: number;
  targetTeamId: number;
};

export const transferTeamEnvelopes = async ({
  sourceTeamId,
  targetTeamId,
}: TransferTeamEnvelopesOptions) => {
  await prisma.envelope.updateMany({
    where: {
      teamId: sourceTeamId,
    },
    data: {
      teamId: targetTeamId,
    },
  });
};
