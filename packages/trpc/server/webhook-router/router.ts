import { router } from '../trpc';
import { createWebhookRoute } from './create-webhook';
import { deleteWebhookRoute } from './delete-webhook';
import { editWebhookRoute } from './edit-webhook';
import { findWebhookCallsRoute } from './find-webhook-calls';
import { getTeamWebhooksRoute } from './get-team-webhooks';
import { getWebhookByIdRoute } from './get-webhook-by-id';
import { resendWebhookCallRoute } from './resend-webhook-call';
import { testWebhookRoute } from './test-webhook';

/**
 * Note: The order of the routes is important for public API routes.
 *
 * Example: GET /webhook/call must appear before GET /webhook/{id}
 */
export const webhookRouter = router({
  calls: {
    find: findWebhookCallsRoute,
    resend: resendWebhookCallRoute,
  },

  getTeamWebhooks: getTeamWebhooksRoute,
  createWebhook: createWebhookRoute,
  editWebhook: editWebhookRoute,
  deleteWebhook: deleteWebhookRoute,
  testWebhook: testWebhookRoute,
  getWebhookById: getWebhookByIdRoute,
});
