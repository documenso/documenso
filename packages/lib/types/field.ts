import { z } from 'zod';

import { FieldSchema } from '@documenso/prisma/generated/zod/modelSchema/FieldSchema';

/**
 * The full field response schema.
 *
 * If you need to return something different, adjust this file to utilise the:
 * - ZFieldSchema
 * - ZFieldLiteSchema
 * - ZFieldManySchema
 *
 * Setup similar to:
 * - ./documents.ts
 * - ./templates.ts
 */
export const ZFieldSchema = FieldSchema.pick({
  type: true,
  id: true,
  secondaryId: true,
  documentId: true,
  templateId: true,
  recipientId: true,
  page: true,
  positionX: true,
  positionY: true,
  width: true,
  height: true,
  customText: true,
  inserted: true,
  fieldMeta: true,
});

export const ZFieldPageNumberSchema = z
  .number()
  .min(1)
  .describe('The page number the field will be on.');

export const ZFieldPageXSchema = z
  .number()
  .min(0)
  .describe('The X coordinate of where the field will be placed.');

export const ZFieldPageYSchema = z
  .number()
  .min(0)
  .describe('The Y coordinate of where the field will be placed.');

export const ZFieldWidthSchema = z.number().min(1).describe('The width of the field.');

export const ZFieldHeightSchema = z.number().min(1).describe('The height of the field.');
