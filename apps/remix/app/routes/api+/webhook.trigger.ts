import { handlerTriggerWebhooks } from '@documenso/lib/server-only/webhooks/trigger/handler';

import type { Route } from './+types/webhook.trigger';

// Todo
// export const config = {
//   maxDuration: 300,
//   api: {
//     bodyParser: {
//       sizeLimit: '50mb',
//     },
//   },
// };

export async function loader({ request }: Route.LoaderArgs) {
  return handlerTriggerWebhooks(request);
}
