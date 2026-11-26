import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { Prisma } from '@prisma/client';

import { adminProcedure } from '../../trpc';
import { ZDeleteAdminTagRequestSchema, ZDeleteAdminTagResponseSchema } from './delete-admin-tag.types';

export const deleteAdminTagRoute = adminProcedure
  .input(ZDeleteAdminTagRequestSchema)
  .output(ZDeleteAdminTagResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { tagId } = input;

    ctx.logger.info({
      input: {
        tagId,
      },
    });

    try {
      await prisma.adminTag.delete({
        where: {
          id: tagId,
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
