import {
  decryptEmailTransportConfig,
  toPublicEmailTransportConfig,
} from '@documenso/lib/server-only/email/email-transport-config';
import { prisma } from '@documenso/prisma';
import { Prisma } from '@prisma/client';

import { adminProcedure } from '../../trpc';
import { ZFindEmailTransportsRequestSchema, ZFindEmailTransportsResponseSchema } from './find-email-transports.types';

export const findEmailTransportsRoute = adminProcedure
  .input(ZFindEmailTransportsRequestSchema)
  .output(ZFindEmailTransportsResponseSchema)
  .query(async ({ input }) => {
    const { query, page = 1, perPage = 20 } = input;

    const where: Prisma.EmailTransportWhereInput = query
      ? {
          OR: [
            { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { fromAddress: { contains: query, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {};

    const [transports, count] = await Promise.all([
      prisma.emailTransport.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { subscriptionClaims: true, organisationClaims: true },
          },
        },
      }),
      prisma.emailTransport.count({ where }),
    ]);

    // Replace the encrypted `config` blob with the non-secret connection
    // settings so the encrypted value (and secrets) never leave the server.
    const data = transports.map(({ config, ...transport }) => {
      let publicConfig: ReturnType<typeof toPublicEmailTransportConfig> | null = null;

      try {
        publicConfig = toPublicEmailTransportConfig(decryptEmailTransportConfig(config));
      } catch {
        publicConfig = null;
      }

      return {
        ...transport,
        config: publicConfig,
      };
    });

    return {
      data,
      count,
      currentPage: page,
      perPage,
      totalPages: Math.ceil(count / perPage),
    };
  });
