import { z } from 'zod';

export const TagType = {
  DOCUMENT: 'DOCUMENT',
  TEMPLATE: 'TEMPLATE',
} as const;

export const ZTagTypeSchema = z.enum([TagType.DOCUMENT, TagType.TEMPLATE]);
export type TTagType = z.infer<typeof ZTagTypeSchema>;
