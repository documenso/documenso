import { handlerTriggerWebhooks } from '@documenso/lib/server-only/webhooks/trigger/handler';

import type { Route } from './+types/webhook.trigger';

// Todo: (RR7)
// export const config = {
//   maxDuration: 300,
//   api: {
//     bodyParser: {
//       sizeLimit: '50mb',
//     },
//   },
// };

export async function action({ request }: Route.ActionArgs) {
  return handlerTriggerWebhooks(request);
}
