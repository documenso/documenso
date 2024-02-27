import type { NextApiRequest, NextApiResponse } from 'next';

import { prisma } from '@documenso/prisma';

import { validateApiToken } from './validateApiToken';

export const subscribeHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { authorization } = req.headers;

    const { webhookUrl, eventTrigger } = req.body;

    const user = await validateApiToken({ authorization });

    const createdWebhook = await prisma.webhook.create({
      data: {
        webhookUrl,
        eventTriggers: [eventTrigger],
        secret: null,
        enabled: true,
        userId: user.id,
      },
    });

    return res.status(200).json(createdWebhook);
  } catch (err) {
    return res.status(500).json({
      message: 'Internal Server Error',
    });
  }
};
