import { prisma } from '@documenso/prisma';

export async function loader() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      status: 'ok',
      message: 'All systems operational',
    });
  } catch (err) {
    console.error(err);

    return Response.json(
      {
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
