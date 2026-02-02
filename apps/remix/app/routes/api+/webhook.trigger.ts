// Todo: [Webhooks] delete file after deployment.
import { handlerTriggerWebhooks } from '@documenso/lib/server-only/webhooks/trigger/handler';

import type { Route } from './+types/webhook.trigger';

export async function action({ request }: Route.ActionArgs) {
  return handlerTriggerWebhooks(request);
}
