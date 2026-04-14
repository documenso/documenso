import { getTeamSettings } from '@documenso/lib/server-only/team/get-team-settings';
import { sha256 } from '@documenso/lib/universal/crypto';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { loadLogo } from '@documenso/lib/utils/images/logo';

import type { Route } from './+types/branding.logo.team.$teamId';

const CACHE_CONTROL = 'public, max-age=0, stale-while-revalidate=86400';

export async function loader({ params, request }: Route.LoaderArgs) {
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

  const etag = `"${Buffer.from(sha256(settings.brandingLogo)).toString('hex')}"`;

  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': CACHE_CONTROL,
      },
    });
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

  const { content, contentType } = await loadLogo(file);

  return new Response(content, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': content.length.toString(),
      'Cache-Control': CACHE_CONTROL,
      ETag: etag,
    },
  });
}
