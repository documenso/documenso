import { z } from 'zod';

const ZCreateRedactionSchema = z.object({
  envelopeItemId: z.string(),
  page: z.number().int().min(1),
  positionX: z.number().min(0).max(100),
  positionY: z.number().min(0).max(100),
  width: z.number().min(0).max(100),
  height: z.number().min(0).max(100),
});

const ZUpdateRedactionSchema = z.object({
  id: z.number().int(),
  page: z.number().int().min(1).optional(),
  positionX: z.number().min(0).max(100).optional(),
  positionY: z.number().min(0).max(100).optional(),
  width: z.number().min(0).max(100).optional(),
  height: z.number().min(0).max(100).optional(),
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
