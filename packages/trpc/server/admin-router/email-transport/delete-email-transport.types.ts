import { z } from 'zod';

export const ZDeleteEmailTransportRequestSchema = z.object({
  id: z.string(),
});

export const ZDeleteEmailTransportResponseSchema = z.void();
