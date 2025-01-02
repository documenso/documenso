import { prisma } from '@documenso/prisma';

import { validateApiToken } from './validateApiToken';

export const unsubscribeHandler = async (req: Request) => {
  try {
    const authorization = req.headers.get('authorization');

    if (!authorization) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { webhookId } = await req.json();

    const result = await validateApiToken({ authorization });

    const deletedWebhook = await prisma.webhook.delete({
      where: {
        id: webhookId,
        userId: result.userId ?? result.user.id,
        teamId: result.teamId ?? undefined,
      },
    });

    return Response.json(deletedWebhook);
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
