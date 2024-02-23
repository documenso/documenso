import type { NextApiRequest, NextApiResponse } from 'next';

import { getUserByApiToken } from './get-user-by-token';

export const testCredentialsHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { authorization } = req.headers;

    // Support for both "Authorization: Bearer api_xxx" and "Authorization: api_xxx"
    const [token] = (authorization || '').split('Bearer ').filter((s) => s.length > 0);

    if (!token) {
      return res.status(500).json({
        body: {
          message: 'API token was not provided',
        },
      });
    }

    const user = await getUserByApiToken({ token });

    return res.status(200).json({
      username: user.name,
      email: user.email,
    });
  } catch (err) {
    return res.status(500).json({
      message: 'Internal Server Error',
    });
  }
};
