import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '@documenso/prisma';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return res.json({
      status: 'ok',
      message: 'All systems operational',
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
}
