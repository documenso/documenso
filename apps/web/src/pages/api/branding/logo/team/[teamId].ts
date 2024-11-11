import type { NextApiRequest, NextApiResponse } from 'next';

import sharp from 'sharp';

import { getFile } from '@documenso/lib/universal/upload/get-file';
import { prisma } from '@documenso/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const teamId = Number(req.query['teamId']);

  if (teamId === 0 || Number.isNaN(teamId)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid team ID',
    });
  }

  const settings = await prisma.teamGlobalSettings.findFirst({
    where: {
      teamId,
    },
  });

  if (!settings || !settings.brandingEnabled) {
    return res.status(404).json({
      status: 'error',
      message: 'Not found',
    });
  }

  if (!settings.brandingLogo) {
    return res.status(404).json({
      status: 'error',
      message: 'Not found',
    });
  }

  const file = await getFile(JSON.parse(settings.brandingLogo)).catch(() => null);

  if (!file) {
    return res.status(404).json({
      status: 'error',
      message: 'Not found',
    });
  }

  const img = await sharp(file)
    .toFormat('png', {
      quality: 80,
    })
    .toBuffer();

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Length', img.length);
  // Stale while revalidate for 1 hours to 24 hours
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  res.status(200).send(img);
}
