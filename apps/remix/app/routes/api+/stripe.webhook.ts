import { stripeWebhookHandler } from '@documenso/ee/server-only/stripe/webhook/handler';

// Todo
// export const config = {
//   api: { bodyParser: false },
// };
import type { Route } from './+types/webhook.trigger';

export async function loader({ request }: Route.LoaderArgs) {
  return stripeWebhookHandler(request);
}
