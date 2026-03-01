import type { PrismaClient } from '@prisma/client';

export function addPrismaMiddleware(prisma: PrismaClient) {
  prisma.$use(async (params, next) => {
    // Check if we're creating a new team
    if (params.model === 'Team' && params.action === 'create') {
      // Execute the team creation
      const result = await next(params);

      // Create the TeamGlobalSettings
      await prisma.teamGlobalSettings.create({
        data: {
          teamId: result.id,
        },
      });

      return result;
    }

    // For all other operations, just pass through
    return next(params);
  });

  return prisma;
}
