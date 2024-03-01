import type { WebhookTriggerEvents } from '@documenso/prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { sign } from '../../crypto/sign';
import { getAllWebhooksByEventTrigger } from '../get-all-webhooks-by-event-trigger';

export type TriggerWebhookOptions = {
  event: WebhookTriggerEvents;
  data: Record<string, unknown>;
  userId: number;
  teamId?: number;
};

export const triggerWebhook = async ({ event, data, userId, teamId }: TriggerWebhookOptions) => {
  try {
    const body = {
      event,
      data,
      userId,
      teamId,
    };

    const registeredWebhooks = await getAllWebhooksByEventTrigger({ event, userId, teamId });

    if (registeredWebhooks.length === 0) {
      return;
    }

    const signature = sign(body);

    await Promise.race([
      fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/api/webhook/trigger`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-signature': signature,
        },
        body: JSON.stringify(body),
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 500);
      }),
    ]).catch(() => null);
  } catch (err) {
    throw new Error(`Failed to trigger webhook`);
  }
};
