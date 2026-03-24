import { createHmac } from 'crypto';

import type { WebhookTriggerEvents } from '@prisma/client';

import { GLOBAL_WEBHOOK_SECRET, GLOBAL_WEBHOOK_URL } from '../../../constants/app';

export type TriggerGlobalWebhookOptions = {
  event: WebhookTriggerEvents;
  data: Record<string, unknown>;
  userId: number;
  teamId: number;
};

/**
 * Triggers the global webhook for SuiteOp platform events.
 * This webhook is triggered for DOCUMENT_SIGNED and DOCUMENT_COMPLETED events
 * and sends notifications to a centralized endpoint for all accounts on the platform.
 */
export const triggerGlobalWebhook = async ({
  event,
  data,
  userId,
  teamId,
}: TriggerGlobalWebhookOptions) => {
  if (!GLOBAL_WEBHOOK_URL) {
    return;
  }

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
    throw err;
  }
};

