import { msg } from '@lingui/macro';
import { z } from 'zod';

export const ZAddSignatureFormSchema = z.object({
  email: z
    .string()
    .min(1, { message: msg`Email is required`.id })
    .email({ message: msg`Invalid email address`.id }),
  name: z.string(),
  customText: z.string(),
  number: z.number().optional(),
  radio: z.string().optional(),
  checkbox: z.boolean().optional(),
  dropdown: z.string().optional(),
  signature: z.string(),
});

export type TAddSignatureFormSchema = z.infer<typeof ZAddSignatureFormSchema>;
