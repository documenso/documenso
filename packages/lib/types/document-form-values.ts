import { z } from 'zod';

export const ZDocumentFormValuesSchema = z.record(
  z.string(),
  z.union([z.string(), z.boolean(), z.number()]),
);

export type TDocumentFormValues = z.infer<typeof ZDocumentFormValuesSchema>;
