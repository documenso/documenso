import { verify } from '../../crypto/verify';
import { getAllWebhooksByEventTrigger } from '../get-all-webhooks-by-event-trigger';
import { executeWebhook } from './execute-webhook';
import { ZTriggerWebhookBodySchema } from './schema';

export type HandlerTriggerWebhooksResponse =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      error: string;
    };

export const handlerTriggerWebhooks = async (req: Request) => {
  const signature = req.headers.get('x-webhook-signature');

  if (typeof signature !== 'string') {
    console.log('Missing signature');
    return Response.json({ success: false, error: 'Missing signature' }, { status: 400 });
  }

  const body = await req.json();

  const valid = verify(body, signature);

  if (!valid) {
    console.log('Invalid signature');
    return Response.json({ success: false, error: 'Invalid signature' }, { status: 400 });
  }

  const result = ZTriggerWebhookBodySchema.safeParse(body);

  if (!result.success) {
    console.log('Invalid request body');
    return Response.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { event, data, userId, teamId } = result.data;

  const allWebhooks = await getAllWebhooksByEventTrigger({ event, userId, teamId });

  await Promise.allSettled(
    allWebhooks.map(async (webhook) =>
      executeWebhook({
        event,
        webhook,
        data,
      }),
    ),
  );

  return Response.json(
    { success: true, message: 'Webhooks executed successfully' },
    { status: 200 },
  );
};
