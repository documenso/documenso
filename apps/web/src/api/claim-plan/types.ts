import { z } from 'zod';

export const ZClaimPlanRequestSchema = z
  .object({
    email: z
      .string()
      .email()
      .transform((value) => value.toLowerCase()),
    name: z.string(),
    planId: z.string(),
  })
  .and(
    z.union([
      z.object({
        signatureDataUrl: z.string().min(1),
        signatureText: z.null(),
      }),
      z.object({
        signatureDataUrl: z.null(),
        signatureText: z.string().min(1),
      }),
    ]),
  );

export type TClaimPlanRequestSchema = z.infer<typeof ZClaimPlanRequestSchema>;

export const ZClaimPlanResponseSchema = z
  .object({
    redirectUrl: z.string(),
  })
  .or(
    z.object({
      error: z.string(),
    }),
  );

export type TClaimPlanResponseSchema = z.infer<typeof ZClaimPlanResponseSchema>;
