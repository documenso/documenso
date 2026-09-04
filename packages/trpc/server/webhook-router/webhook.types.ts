import WebhookTriggerEventsSchema from '@documenso/prisma/generated/zod/inputTypeSchemas/WebhookTriggerEventsSchema';
import { z } from 'zod';

export const ZWebhookResponseSchema = z.object({
  id: z.string(),
  webhookUrl: z.string(),
  eventTriggers: WebhookTriggerEventsSchema.array(),
  secret: z.string().nullable(),
  enabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.number(),
  teamId: z.number(),
});

export type TWebhookResponse = z.infer<typeof ZWebhookResponseSchema>;
