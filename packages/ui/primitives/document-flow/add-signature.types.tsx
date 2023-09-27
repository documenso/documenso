import { z } from 'zod';

export const ZAddSignatureFormSchema = z.object({
  email: z.string().min(1).email(),
  name: z.string(),
  signature: z.string(),
});

export type TAddSignatureFormSchema = z.infer<typeof ZAddSignatureFormSchema>;
