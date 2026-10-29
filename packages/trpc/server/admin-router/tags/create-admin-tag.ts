import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../../trpc';
import { ZCreateAdminTagRequestSchema, ZCreateAdminTagResponseSchema } from './create-admin-tag.types';

export const createAdminTagRoute = adminProcedure
  .input(ZCreateAdminTagRequestSchema)
  .output(ZCreateAdminTagResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { userId, organisationId, type, description } = input;

    ctx.logger.info({
      input: {
        userId,
        organisationId,
        type,
      },
    });

    const tag = await prisma.adminTag.create({
      data: {
        id: generateDatabaseId('admin_tag'),
        type,
        description,
        userId,
        organisationId,
        createdByUserId: ctx.user.id,
      },
    });

    return tag;
  });
