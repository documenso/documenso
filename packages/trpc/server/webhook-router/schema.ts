import { z } from 'zod';

import { WebhookTriggerEvents } from '@documenso/prisma/client';

export const ZGetTeamWebhooksQuerySchema = z.object({
  teamId: z.number(),
});

export type TGetTeamWebhooksQuerySchema = z.infer<typeof ZGetTeamWebhooksQuerySchema>;

export const ZCreateWebhookMutationSchema = z.object({
  webhookUrl: z.string().url(),
  eventTriggers: z
    .array(z.nativeEnum(WebhookTriggerEvents))
    .min(1, { message: 'At least one event trigger is required' }),
  secret: z.string().nullable(),
  enabled: z.boolean(),
  teamId: z.number().optional(),
});

export type TCreateWebhookFormSchema = z.infer<typeof ZCreateWebhookMutationSchema>;

export const ZGetWebhookByIdQuerySchema = z.object({
  id: z.string(),
  teamId: z.number().optional(),
});

export type TGetWebhookByIdQuerySchema = z.infer<typeof ZGetWebhookByIdQuerySchema>;

export const ZEditWebhookMutationSchema = ZCreateWebhookMutationSchema.extend({
  id: z.string(),
});

export type TEditWebhookMutationSchema = z.infer<typeof ZEditWebhookMutationSchema>;

export const ZDeleteWebhookMutationSchema = z.object({
  id: z.string(),
  teamId: z.number().optional(),
});

export type TDeleteWebhookMutationSchema = z.infer<typeof ZDeleteWebhookMutationSchema>;
