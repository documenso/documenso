import { encryptEmailTransportConfig } from '@documenso/lib/server-only/email/email-transport-config';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../../trpc';
import {
  ZCreateEmailTransportRequestSchema,
  ZCreateEmailTransportResponseSchema,
} from './create-email-transport.types';

export const createEmailTransportRoute = adminProcedure
  .input(ZCreateEmailTransportRequestSchema)
  .output(ZCreateEmailTransportResponseSchema)
  .mutation(async ({ input }) => {
    const { name, fromName, fromAddress, config } = input;

    const transport = await prisma.emailTransports.create({
      data: {
        name,
        type: config.type,
        fromName,
        fromAddress,
        config: encryptEmailTransportConfig(config),
      },
      select: { id: true },
    });

    return {
      id: transport.id,
    };
  });
