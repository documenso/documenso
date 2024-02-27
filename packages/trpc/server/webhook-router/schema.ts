import { z } from 'zod';

import { WebhookTriggerEvents } from '@documenso/prisma/client';

export const ZCreateWebhookFormSchema = z.object({
  webhookUrl: z.string().url(),
  eventTriggers: z
    .array(z.nativeEnum(WebhookTriggerEvents))
    .min(1, { message: 'At least one event trigger is required' }),
  secret: z.string().nullable(),
  enabled: z.boolean(),
});

export type TCreateWebhookFormSchema = z.infer<typeof ZCreateWebhookFormSchema>;

export const ZGetWebhookByIdQuerySchema = z.object({
  id: z.string(),
});

export type TGetWebhookByIdQuerySchema = z.infer<typeof ZGetWebhookByIdQuerySchema>;

export const ZEditWebhookMutationSchema = ZCreateWebhookFormSchema.extend({
  id: z.string(),
});

export type TEditWebhookMutationSchema = z.infer<typeof ZEditWebhookMutationSchema>;

export const ZDeleteWebhookMutationSchema = z.object({
  id: z.string(),
});

export type TDeleteWebhookMutationSchema = z.infer<typeof ZDeleteWebhookMutationSchema>;
