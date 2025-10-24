import { z } from 'zod';

import { DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT } from './constants';

// Not proud of the below but it's a way to deal with Infinity when returning JSON.
export const ZLimitsSchema = z.object({
  documents: z
    .preprocess((v) => (v === null ? Infinity : Number(v)), z.number())
    .optional()
    .default(0),
  recipients: z
    .preprocess((v) => (v === null ? Infinity : Number(v)), z.number())
    .optional()
    .default(0),
  directTemplates: z
    .preprocess((v) => (v === null ? Infinity : Number(v)), z.number())
    .optional()
    .default(0),
});

export type TLimitsSchema = z.infer<typeof ZLimitsSchema>;

export const ZLimitsResponseSchema = z.object({
  quota: ZLimitsSchema,
  remaining: ZLimitsSchema,
  maximumEnvelopeItemCount: z.number().optional().default(DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT),
});

export type TLimitsResponseSchema = z.infer<typeof ZLimitsResponseSchema>;

export const ZLimitsErrorResponseSchema = z.object({
  error: z.string(),
});

export type TLimitsErrorResponseSchema = z.infer<typeof ZLimitsErrorResponseSchema>;
