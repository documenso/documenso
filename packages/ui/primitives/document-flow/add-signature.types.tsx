import { z } from 'zod';

export const ZAddSignatureFormSchema = z.object({
  email: z.string().min(1).email(),
  name: z.string(),
  signature: z.string(),
  timezone: z.string().optional().default('Europe/London'),
  dateFormat: z.string().optional().default('MM-dd-yyyy hh:mm a'),
});

export type TAddSignatureFormSchema = z.infer<typeof ZAddSignatureFormSchema>;
