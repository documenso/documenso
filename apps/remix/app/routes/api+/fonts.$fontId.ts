import { getFontAssetFile } from '@documenso/lib/server-only/fonts/font-assets';
import { sha256 } from '@documenso/lib/universal/crypto';

import type { Route } from './+types/fonts.$fontId';

const CACHE_CONTROL = 'public, max-age=31536000, immutable';

export async function loader({ params, request }: Route.LoaderArgs) {
  const { fontId } = params;

  if (!fontId) {
    return Response.json(
      {
        status: 'error',
        message: 'Font not found',
      },
      { status: 404 },
    );
  }

  const result = await getFontAssetFile({
    fontId,
  }).catch((error) => {
    console.error(error);

    return null;
  });

  if (!result) {
    return Response.json(
      {
        status: 'error',
        message: 'Font not found',
      },
      { status: 404 },
    );
  }

  const etag = `"${Buffer.from(sha256(result.fontAsset.data)).toString('hex')}"`;

  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': CACHE_CONTROL,
      },
    });
  }

  return new Response(result.bytes, {
    headers: {
      'Content-Type': result.fontAsset.mimeType,
      'Content-Length': result.bytes.length.toString(),
      'Cache-Control': CACHE_CONTROL,
      ETag: etag,
    },
  });
}
