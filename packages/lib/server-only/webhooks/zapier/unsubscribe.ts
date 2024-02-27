import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '@documenso/prisma';

import { validateApiToken } from './validateApiToken';

export const unsubscribeHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { authorization } = req.headers;

    const { webhookId } = req.body;

    const user = await validateApiToken({ authorization });

    const deletedWebhook = await prisma.webhook.delete({
      where: {
        id: webhookId,
        userId: user.id,
      },
    });

    return res.status(200).json(deletedWebhook);
  } catch (err) {
    return res.status(500).json({
      message: 'Internal Server Error',
    });
  }
};
