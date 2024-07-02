import { z } from 'zod';

export const ZAddSignatureFormSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Invalid email address' }),
  name: z.string(),
  customText: z.string(),
  number: z.number().optional(),
  radio: z.string().optional(),
  checkbox: z.boolean().optional(),
  dropdown: z.string().optional(),
  signature: z.string(),
});

export type TAddSignatureFormSchema = z.infer<typeof ZAddSignatureFormSchema>;
