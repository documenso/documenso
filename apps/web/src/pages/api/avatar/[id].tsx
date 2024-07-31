import type { NextApiRequest, NextApiResponse } from 'next';

import { getAvatarImage } from '@documenso/lib/server-only/profile/get-avatar-image';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 'error',
      message: 'Method not allowed',
    });
  }

  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({
      status: 'error',
      message: 'Missing id',
    });
  }

  const result = await getAvatarImage({ id });

  if (!result) {
    return res.status(404).json({
      status: 'error',
      message: 'Not found',
    });
  }

  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(result.content);
}
