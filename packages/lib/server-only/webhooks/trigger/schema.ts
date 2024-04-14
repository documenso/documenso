import { z } from 'zod';

import { WebhookTriggerEvents } from '@documenso/prisma/client';

export const ZTriggerWebhookBodySchema = z.object({
  event: z.nativeEnum(WebhookTriggerEvents),
  data: z.unknown(),
  userId: z.number(),
  teamId: z.number().optional(),
});

export type TTriggerWebhookBodySchema = z.infer<typeof ZTriggerWebhookBodySchema>;
