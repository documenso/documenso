import { isPrivateUrl } from '@documenso/lib/server-only/webhooks/is-private-url';
import { URL_PATTERN } from '@documenso/lib/types/name';
import WebhookTriggerEventsSchema from '@documenso/prisma/generated/zod/inputTypeSchemas/WebhookTriggerEventsSchema';
import { z } from 'zod';

export const ZWebhookUrlSchema = z
  .string()
  .url()
  .refine((url) => !isPrivateUrl(url), {
    message: 'Webhook URL cannot point to a private or loopback address',
  })
  /*
   * Without this, values like "foo: bar" would be valid URLs.
   * Keep the same error message as the zod url() validator.
   */
  .refine((value) => URL_PATTERN.test(value), {
    message: 'Invalid url',
  });

export const ZCreateWebhookRequestSchema = z.object({
  webhookUrl: ZWebhookUrlSchema,
  eventTriggers: WebhookTriggerEventsSchema.array().min(1, {
    message: 'At least one event trigger is required',
  }),
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
  event: WebhookTriggerEventsSchema,
});

export type TTriggerTestWebhookRequestSchema = z.infer<typeof ZTriggerTestWebhookRequestSchema>;
