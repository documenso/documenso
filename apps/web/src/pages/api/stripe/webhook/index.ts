import { stripeWebhookHandler } from '@documenso/ee/server-only/stripe/webhook/handler';

export const config = {
  api: { bodyParser: false },
};

export default stripeWebhookHandler;
