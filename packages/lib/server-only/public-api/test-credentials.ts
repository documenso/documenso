import type { NextApiRequest, NextApiResponse } from 'next';

import { validateApiToken } from '@documenso/lib/server-only/webhooks/zapier/validateApiToken';

export const testCredentialsHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { authorization } = req.headers;

    const result = await validateApiToken({ authorization });

    return res.status(200).json({
      name: result.team?.name ?? result.user.name,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Internal Server Error',
    });
  }
};
