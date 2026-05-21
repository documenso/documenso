import { FieldType } from '@prisma/client';
import { z } from 'zod';

import { ZFieldMetaNotOptionalSchema } from './field-meta';

/**
 * A form field detected inside an uploaded PDF's interactive form (AcroForm).
 *
 * Positions use the same 0-100 percentage scale and top-left origin as the
 * Field model, so a detected field can be turned into a real field without
 * further coordinate conversion.
 */
export const ZDetectedFieldSchema = z.object({
  type: z.nativeEnum(FieldType),
  /** 1-based page number the field appears on. */
  page: z.number().int().min(1),
  positionX: z.number().min(0).max(100),
  positionY: z.number().min(0).max(100),
  width: z.number().min(0).max(100),
  height: z.number().min(0).max(100),
  /** Original (fully-qualified) field name from the PDF. */
  name: z.string(),
  fieldMeta: ZFieldMetaNotOptionalSchema.optional(),
});

export type TDetectedField = z.infer<typeof ZDetectedFieldSchema>;

/**
 * Tolerant parser for detected fields loaded from the database.
 *
 * Detected fields are written by us so they should always be valid, but a
 * malformed value should never break loading the whole envelope - we simply
 * treat it as "nothing detected".
 */
export const ZDetectedFieldsSchema = ZDetectedFieldSchema.array().nullish().catch(undefined);
