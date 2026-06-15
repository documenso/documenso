import { z } from 'zod';
import { hasInvalidTextCharacters } from '../utils/zod';

export const URL_PATTERN = /https?:\/\/|www\./i;

/**
 * Shared name schema that disallows URLs to prevent phishing via email rendering,
 * and invisible/control characters that render as empty or break the UI.
 */
export const ZNameSchema = z
  .string()
  .trim()
  .min(2, { message: 'Please enter a valid name.' })
  .max(100, { message: 'Name cannot be more than 100 characters.' })
  .refine((value) => !URL_PATTERN.test(value), {
    message: 'Name cannot contain URLs.',
  })
  .refine((value) => !hasInvalidTextCharacters(value), {
    message: 'Name contains invalid characters.',
  });

export type TName = z.infer<typeof ZNameSchema>;
