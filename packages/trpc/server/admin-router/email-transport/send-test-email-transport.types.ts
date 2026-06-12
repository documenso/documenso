import { z } from 'zod';

export const ZSendTestEmailTransportRequestSchema = z.object({
  id: z.string(),
  to: z.string().email(),
});

export const ZSendTestEmailTransportResponseSchema = z.void();

export type TSendTestEmailTransportResponse = z.infer<typeof ZSendTestEmailTransportResponseSchema>;
