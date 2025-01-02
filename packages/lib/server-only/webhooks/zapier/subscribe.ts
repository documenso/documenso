import { prisma } from '@documenso/prisma';

import { validateApiToken } from './validateApiToken';

export const subscribeHandler = async (req: Request) => {
  try {
    const authorization = req.headers.get('authorization');

    if (!authorization) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { webhookUrl, eventTrigger } = await req.json();

    const result = await validateApiToken({ authorization });

    const createdWebhook = await prisma.webhook.create({
      data: {
        webhookUrl,
        eventTriggers: [eventTrigger],
        secret: null,
        enabled: true,
        userId: result.userId ?? result.user.id,
        teamId: result.teamId ?? undefined,
      },
    });

    return Response.json(createdWebhook);
  } catch (err) {
    console.error(err);

    return Response.json(
      {
        message: 'Internal Server Error',
      },
      { status: 500 },
    );
  }
};
