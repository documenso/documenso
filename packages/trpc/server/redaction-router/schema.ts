import { z } from 'zod';

// Width/height must be strictly positive — a zero-sized redaction would
// silently produce no visible effect and give the sender false confidence
// that the content was covered.
const ZRedactionWidthSchema = z.number().gt(0).max(100);
const ZRedactionHeightSchema = z.number().gt(0).max(100);
const ZRedactionPositionSchema = z.number().min(0).max(100);

const ZCreateRedactionSchema = z.object({
  envelopeItemId: z.string(),
  page: z.number().int().min(1),
  positionX: ZRedactionPositionSchema,
  positionY: ZRedactionPositionSchema,
  width: ZRedactionWidthSchema,
  height: ZRedactionHeightSchema,
});

const ZUpdateRedactionSchema = z.object({
  id: z.number().int(),
  page: z.number().int().min(1).optional(),
  positionX: ZRedactionPositionSchema.optional(),
  positionY: ZRedactionPositionSchema.optional(),
  width: ZRedactionWidthSchema.optional(),
  height: ZRedactionHeightSchema.optional(),
});

export const ZRedactionResponseSchema = z.object({
  id: z.number(),
  secondaryId: z.string(),
  envelopeItemId: z.string(),
  page: z.number(),
  positionX: z.number(),
  positionY: z.number(),
  width: z.number(),
  height: z.number(),
});

export const ZCreateDocumentRedactionsRequestSchema = z.object({
  documentId: z.number(),
  redactions: z.array(ZCreateRedactionSchema).min(1).max(200),
});

export const ZCreateDocumentRedactionsResponseSchema = z.object({
  redactions: z.array(ZRedactionResponseSchema),
});

export const ZUpdateDocumentRedactionsRequestSchema = z.object({
  documentId: z.number(),
  redactions: z.array(ZUpdateRedactionSchema).min(1).max(200),
});

export const ZUpdateDocumentRedactionsResponseSchema = z.object({
  redactions: z.array(ZRedactionResponseSchema),
});

export const ZDeleteDocumentRedactionRequestSchema = z.object({
  documentId: z.number(),
  redactionId: z.number(),
});
