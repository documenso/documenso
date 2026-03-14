import { z } from 'zod';

import {
  ZConfidenceLevel,
  ZDetectableFieldType,
} from '@documenso/lib/server-only/ai/envelope/detect-fields/schema';

export const ZDetectFieldsRequestSchema = z.object({
  envelopeId: z.string().min(1).describe('The ID of the envelope to detect fields from.'),
  teamId: z.number().describe('The ID of the team the envelope belongs to.'),
  context: z
    .string()
    .optional()
    .describe(
      'Optional context about recipients to help map fields (e.g., "David is the Employee, Lucas is the Manager").',
    ),
});

export type TDetectFieldsRequest = z.infer<typeof ZDetectFieldsRequestSchema>;

// Schema for fields returned from streaming API (before recipient resolution)
export const ZNormalizedFieldWithPageSchema = z.object({
  type: ZDetectableFieldType,
  recipientKey: z.string(),
  positionX: z.number(),
  positionY: z.number(),
  width: z.number(),
  height: z.number(),
  confidence: ZConfidenceLevel,
  pageNumber: z.number(),
});

export type TNormalizedFieldWithPage = z.infer<typeof ZNormalizedFieldWithPageSchema>;

// Schema for fields after recipient resolution
export const ZNormalizedFieldWithContextSchema = z.object({
  type: ZDetectableFieldType,
  positionX: z.number(),
  positionY: z.number(),
  width: z.number(),
  height: z.number(),
  confidence: ZConfidenceLevel,
  pageNumber: z.number(),
  recipientId: z.number(),
  envelopeItemId: z.string(),
});

export type TNormalizedFieldWithContext = z.infer<typeof ZNormalizedFieldWithContextSchema>;

export const ZDetectFieldsResponseSchema = z.object({
  fields: z.array(ZNormalizedFieldWithContextSchema),
});

export type TDetectFieldsResponse = z.infer<typeof ZDetectFieldsResponseSchema>;
