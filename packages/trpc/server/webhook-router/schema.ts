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

export const ZGetWebhookByIdQuerySchema = z.object({
  id: z.number(),
});

export const ZEditWebhookMutationSchema = ZCreateWebhookFormSchema.extend({
  id: z.number(),
});

export const ZDeleteWebhookMutationSchema = z.object({
  id: z.number(),
});

export type TCreateWebhookFormSchema = z.infer<typeof ZCreateWebhookFormSchema>;

export type TGetWebhookByIdQuerySchema = z.infer<typeof ZGetWebhookByIdQuerySchema>;

export type TDeleteWebhookMutationSchema = z.infer<typeof ZDeleteWebhookMutationSchema>;

export type TEditWebhookMutationSchema = z.infer<typeof ZEditWebhookMutationSchema>;
