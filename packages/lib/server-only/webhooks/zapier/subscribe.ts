import { AppError } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { assertNotPrivateUrl } from '../assert-webhook-url';
import { validateApiToken } from './validateApiToken';

export const subscribeHandler = async (req: Request) => {
  try {
    const authorization = req.headers.get('authorization');

    if (!authorization) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { webhookUrl, eventTrigger } = await req.json();

    await assertNotPrivateUrl(webhookUrl);

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
    if (err instanceof AppError) {
      return Response.json({ message: err.message }, { status: 400 });
    }

    console.error(err);

    return Response.json(
      {
        message: 'Internal Server Error',
      },
      { status: 500 },
    );
  }
};
