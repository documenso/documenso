import { createHmac } from 'crypto';

import { GLOBAL_WEBHOOK_SECRET, GLOBAL_WEBHOOK_URL } from '../../../constants/app';
import { jobs } from '../../../jobs/client';
import { verify } from '../../crypto/verify';
import { getAllWebhooksByEventTrigger } from '../get-all-webhooks-by-event-trigger';
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

  // Trigger user-configured webhooks
  await Promise.allSettled(
    allWebhooks.map(async (webhook) => {
      await jobs.triggerJob({
        name: 'internal.execute-webhook',
        payload: {
          event,
          webhookId: webhook.id,
          data,
        },
      });
    }),
  );

  // Trigger global webhook for specific events
  const shouldTriggerGlobalWebhook = event === 'DOCUMENT_SIGNED' || event === 'DOCUMENT_COMPLETED';

  if (shouldTriggerGlobalWebhook) {
    console.log(
      `[Global Webhook] Triggering for event: ${event}, userId: ${userId}, teamId: ${teamId}`,
    );

    try {
      const payloadData = {
        event,
        payload: data,
        createdAt: new Date().toISOString(),
        webhookEndpoint: GLOBAL_WEBHOOK_URL,
        userId,
        teamId,
      };

      const payloadString = JSON.stringify(payloadData);

      // Sign the webhook payload using HMAC SHA256 if secret is configured
      let signature = '';
      if (GLOBAL_WEBHOOK_SECRET) {
        const hmac = createHmac('sha256', GLOBAL_WEBHOOK_SECRET);
        hmac.update(payloadString);
        signature = hmac.digest('hex');
      }

      const response = await fetch(GLOBAL_WEBHOOK_URL, {
        method: 'POST',
        body: payloadString,
        headers: {
          'Content-Type': 'application/json',
          'X-SuiteOp-Global-Webhook': 'true',
          ...(signature && { 'X-SuiteOp-Signature': signature }),
        },
      });

      if (response.ok) {
        console.log(`[Global Webhook] Successfully sent ${event} event to ${GLOBAL_WEBHOOK_URL}`);
      } else {
        console.error(
          `[Global Webhook] Failed with status ${response.status}: ${await response.text()}`,
        );
      }
    } catch (err) {
      console.error('[Global Webhook] Error triggering global webhook:', err);
    }
  }

  return Response.json(
    { success: true, message: 'Webhooks queued for execution' },
    { status: 200 },
  );
};
