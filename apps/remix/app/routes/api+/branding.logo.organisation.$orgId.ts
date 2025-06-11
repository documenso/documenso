import sharp from 'sharp';

import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { prisma } from '@documenso/prisma';

import type { Route } from './+types/branding.logo.team.$teamId';

export async function loader({ params }: Route.LoaderArgs) {
  const organisationId = params.orgId;

  if (!organisationId) {
    return Response.json(
      {
        status: 'error',
        message: 'Invalid organisation ID',
      },
      { status: 400 },
    );
  }

  const organisation = await prisma.organisation.findUnique({
    where: {
      id: organisationId,
    },
    include: {
      organisationGlobalSettings: true,
    },
  });

  const settings = organisation?.organisationGlobalSettings;

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
