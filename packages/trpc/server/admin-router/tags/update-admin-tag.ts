import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { Prisma } from '@prisma/client';

import { adminProcedure } from '../../trpc';
import { ZUpdateAdminTagRequestSchema, ZUpdateAdminTagResponseSchema } from './update-admin-tag.types';

export const updateAdminTagRoute = adminProcedure
  .input(ZUpdateAdminTagRequestSchema)
  .output(ZUpdateAdminTagResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { tagId, data } = input;

    ctx.logger.info({
      input: {
        tagId,
        type: data.type,
      },
    });

    try {
      return await prisma.adminTag.update({
        where: {
          id: tagId,
        },
        data: {
          type: data.type,
          description: data.description,
        },
      });
    } catch (err) {
      // P2025: no tag matched, so report NOT_FOUND rather than a 500.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Tag not found' });
      }

      throw err;
    }
  });
