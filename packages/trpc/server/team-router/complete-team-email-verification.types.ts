import { z } from 'zod';

export const ZCompleteTeamEmailVerificationRequestSchema = z.object({
  token: z.string().min(1),
});

export const ZCompleteTeamEmailVerificationResponseSchema = z.void();

export type TCompleteTeamEmailVerificationRequest = z.infer<typeof ZCompleteTeamEmailVerificationRequestSchema>;

export type TCompleteTeamEmailVerificationResponse = z.infer<typeof ZCompleteTeamEmailVerificationResponseSchema>;
