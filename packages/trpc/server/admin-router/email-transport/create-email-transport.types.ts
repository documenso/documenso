import { ZEmailTransportConfigSchema } from '@documenso/lib/server-only/email/email-transport-config';
import { z } from 'zod';

export const ZCreateEmailTransportRequestSchema = z.object({
  name: z.string().min(1),
  fromName: z.string().min(1),
  fromAddress: z.string().email(),
  config: ZEmailTransportConfigSchema,
});

export const ZCreateEmailTransportResponseSchema = z.object({
  id: z.string(),
});

export type TCreateEmailTransportRequest = z.infer<typeof ZCreateEmailTransportRequestSchema>;
