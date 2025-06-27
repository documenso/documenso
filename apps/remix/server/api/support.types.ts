import { z } from 'zod';

export const ZSupportTicketRequestSchema = z.object({
  email: z.string().email(),
  subject: z.string(),
  message: z.string(),
});

export type TSupportTicketRequest = z.infer<typeof ZSupportTicketRequestSchema>;
