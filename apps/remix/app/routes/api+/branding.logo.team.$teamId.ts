import sharp from 'sharp';

import { getTeamSettings } from '@documenso/lib/server-only/team/get-team-settings';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';

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

  const settings = await getTeamSettings({
    teamId,
  });

  if (!settings || !settings.brandingLogo) {
    return Response.json(
      {
        status: 'error',
        message: 'Logo not found',
      },
      { status: 404 },
    );
  }

  if (!settings.brandingEnabled) {
    return Response.json(
      {
        status: 'error',
        message: 'Branding is not enabled',
      },
      { status: 400 },
    );
  }

  const file = await getFileServerSide(JSON.parse(settings.brandingLogo)).catch((e) => {
    console.error(e);
  });

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
