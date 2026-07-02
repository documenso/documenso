import { z } from 'zod';

export const ZReportRecipientRequestSchema = z.object({
  token: z.string().min(1).describe('The recipient token from the email link used to report the sender.'),
});

export const ZReportRecipientResponseSchema = z.void();

export type TReportRecipientRequest = z.infer<typeof ZReportRecipientRequestSchema>;
