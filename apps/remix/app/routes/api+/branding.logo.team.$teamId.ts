import sharp from 'sharp';

import { getFile } from '@documenso/lib/universal/upload/get-file';
import { prisma } from '@documenso/prisma';

import type { Route } from './+types/branding.logo.team.$teamId';

export async function loader({ params }: Route.LoaderArgs) {
  const teamId = Number(params.teamId);

  if (teamId === 0 || Number.isNaN(teamId)) {
    return Response.json(
      {
        status: 'error',
        message: 'Invalid team ID',
      },
      { status: 400 },
    );
  }

  const settings = await prisma.teamGlobalSettings.findFirst({
    where: {
      teamId,
    },
  });

  if (!settings || !settings.brandingEnabled) {
    return Response.json(
      {
        status: 'error',
        message: 'Not found',
      },
      { status: 404 },
    );
  }

  if (!settings.brandingLogo) {
    return Response.json(
      {
        status: 'error',
        message: 'Not found',
      },
      { status: 404 },
    );
  }

  const file = await getFile(JSON.parse(settings.brandingLogo)).catch(() => null);

  if (!file) {
    return Response.json(
      {
        status: 'error',
        message: 'Not found',
      },
      { status: 404 },
    );
  }

  const img = await sharp(file)
    .toFormat('png', {
      quality: 80,
    })
    .toBuffer();

  return new Response(img, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': img.length.toString(),
      // Stale while revalidate for 1 hours to 24 hours
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
