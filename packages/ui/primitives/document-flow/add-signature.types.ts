import { z } from 'zod';

export const ZAddSignatureFormSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'ელ.ფოსტა აუცილებელია' })
    .email({ message: 'არასწორი ელ.ფოსტის მისამართი' }),
  name: z.string(),
  customText: z.string(),
  number: z.number().optional(),
  radio: z.string().optional(),
  checkbox: z.boolean().optional(),
  dropdown: z.string().optional(),
  signature: z.string(),
});

export type TAddSignatureFormSchema = z.infer<typeof ZAddSignatureFormSchema>;
