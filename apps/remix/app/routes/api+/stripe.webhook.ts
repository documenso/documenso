import { stripeWebhookHandler } from '@documenso/ee/server-only/stripe/webhook/handler';

// Todo
// export const config = {
//   api: { bodyParser: false },
// };
import type { Route } from './+types/webhook.trigger';

export async function action({ request }: Route.ActionArgs) {
  return stripeWebhookHandler(request);
}
