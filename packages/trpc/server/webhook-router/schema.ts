import { WebhookTriggerEvents } from '@prisma/client';
import { z } from 'zod';

import { isPrivateUrl } from '@documenso/lib/server-only/webhooks/is-private-url';

export const ZWebhookUrlSchema = z
  .string()
  .url()
  .refine((url) => !isPrivateUrl(url), {
    message: 'Webhook URL cannot point to a private or loopback address',
  });

export const ZCreateWebhookRequestSchema = z.object({
  webhookUrl: ZWebhookUrlSchema,
  eventTriggers: z
    .array(z.nativeEnum(WebhookTriggerEvents))
    .min(1, { message: 'At least one event trigger is required' }),
  secret: z.string().nullable(),
  enabled: z.boolean(),
});

export type TCreateWebhookFormSchema = z.infer<typeof ZCreateWebhookRequestSchema>;

export const ZGetWebhookByIdRequestSchema = z.object({
  id: z.string(),
});

export type TGetWebhookByIdRequestSchema = z.infer<typeof ZGetWebhookByIdRequestSchema>;

export const ZEditWebhookRequestSchema = ZCreateWebhookRequestSchema.extend({
  id: z.string(),
});

export type TEditWebhookRequestSchema = z.infer<typeof ZEditWebhookRequestSchema>;

export const ZDeleteWebhookRequestSchema = z.object({
  id: z.string(),
});

export type TDeleteWebhookRequestSchema = z.infer<typeof ZDeleteWebhookRequestSchema>;

export const ZTriggerTestWebhookRequestSchema = z.object({
  id: z.string(),
  event: z.nativeEnum(WebhookTriggerEvents),
});

export type TTriggerTestWebhookRequestSchema = z.infer<typeof ZTriggerTestWebhookRequestSchema>;
