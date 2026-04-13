import { RecipientRole } from '@prisma/client';
import { z } from 'zod';

import { zEmail } from '../utils/zod';

export const ZDefaultRecipientSchema = z.object({
  email: zEmail(),
  name: z.string(),
  role: z.nativeEnum(RecipientRole),
});

export type TDefaultRecipient = z.infer<typeof ZDefaultRecipientSchema>;

export const ZDefaultRecipientsSchema = z.array(ZDefaultRecipientSchema);

export type TDefaultRecipients = z.infer<typeof ZDefaultRecipientsSchema>;
