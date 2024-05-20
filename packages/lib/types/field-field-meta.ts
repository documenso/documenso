import { z } from 'zod';

export const ZFieldMetaSchema = z.object({
  label: z.string().optional(),
  placeholder: z.string().optional(),
  format: z.string().optional(),
  characterLimit: z.number().optional(),
  required: z.boolean().optional(),
  readOnly: z.boolean().optional(),
});
