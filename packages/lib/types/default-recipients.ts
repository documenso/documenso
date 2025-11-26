import { RecipientRole } from '@prisma/client';
import { z } from 'zod';

export const ZDefaultRecipientSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  role: z.nativeEnum(RecipientRole),
});

export const ZDefaultRecipientsSchema = z.array(ZDefaultRecipientSchema);

export type TDefaultRecipients = z.infer<typeof ZDefaultRecipientsSchema>;
