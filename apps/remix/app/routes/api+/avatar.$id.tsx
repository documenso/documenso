import { getAvatarImage } from '@documenso/lib/server-only/profile/get-avatar-image';

import type { Route } from './+types/avatar.$id';

export async function loader({ params }: Route.LoaderArgs) {
  const { id } = params;

  if (typeof id !== 'string') {
    return Response.json(
      {
        status: 'error',
        message: 'Missing id',
      },
      { status: 400 },
    );
  }

  const result = await getAvatarImage({ id });

  if (!result) {
    return Response.json(
      {
        status: 'error',
        message: 'Not found',
      },
      { status: 404 },
    );
  }

  // res.setHeader('Content-Type', result.contentType);
  // res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  // res.send(result.content);

  return new Response(result.content, {
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
