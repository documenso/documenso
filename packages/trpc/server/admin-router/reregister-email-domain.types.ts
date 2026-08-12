import { z } from 'zod';

export const ZReregisterEmailDomainRequestSchema = z.object({
  emailDomainId: z.string(),
});

export const ZReregisterEmailDomainResponseSchema = z.void();

export type TReregisterEmailDomainRequest = z.infer<typeof ZReregisterEmailDomainRequestSchema>;
export type TReregisterEmailDomainResponse = z.infer<typeof ZReregisterEmailDomainResponseSchema>;
