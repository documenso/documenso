import { z } from 'zod';

export const ZSupportTicketRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  subject: z.string().min(3, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

export type TSupportTicketRequest = z.infer<typeof ZSupportTicketRequestSchema>;
