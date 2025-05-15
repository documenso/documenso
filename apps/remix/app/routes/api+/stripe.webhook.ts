import { stripeWebhookHandler } from '@documenso/ee/server-only/stripe/webhook/handler';

import type { Route } from './+types/webhook.trigger';

export async function action({ request }: Route.ActionArgs) {
  return await stripeWebhookHandler(request);
}
