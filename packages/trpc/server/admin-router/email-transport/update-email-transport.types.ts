import {
  ZMailChannelsConfigSchema,
  ZResendConfigSchema,
  ZSmtpApiConfigSchema,
  ZSmtpAuthConfigSchema,
} from '@documenso/lib/server-only/email/email-transport-config';
import { z } from 'zod';

// Reuses the canonical transport config schemas, but relaxes the secret field so
// a blank/omitted value means "keep existing". Note: `.partial()` only makes the
// key optional — it keeps the `.min(1)` validator, so an empty string would be
// rejected. We override the secret field with a plain optional string instead.
// (SMTP_AUTH's `password` is already optional in the source schema.)
const ZUpdateConfigSchema = z.discriminatedUnion('type', [
  ZSmtpAuthConfigSchema,
  ZSmtpApiConfigSchema.extend({ apiKey: z.string().optional() }),
  ZResendConfigSchema.extend({ apiKey: z.string().optional() }),
  ZMailChannelsConfigSchema.extend({ apiKey: z.string().optional() }),
]);

export const ZUpdateEmailTransportRequestSchema = z.object({
  id: z.string(),
  data: z.object({
    name: z.string().min(1),
    fromName: z.string().min(1),
    fromAddress: z.string().email(),
    config: ZUpdateConfigSchema,
  }),
});

export const ZUpdateEmailTransportResponseSchema = z.void();

export type TUpdateEmailTransportRequest = z.infer<typeof ZUpdateEmailTransportRequestSchema>;
